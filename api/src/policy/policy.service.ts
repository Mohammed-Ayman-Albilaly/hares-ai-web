import { createHash, randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORY_CODES,
  defaultActionFor,
  PolicyBundleResponseSchema,
  splitKeywords,
  type CategoryCode,
  type CategoryPolicyEntry,
  type CustomRuleListResponse,
  type CustomRuleRequest,
  type CustomRuleResponse,
  type DepartmentPolicyResponse,
  type OrgPolicyResponse,
  type PolicyBundleResponse,
  type PolicyCategoryActionRequest,
} from '@hares/contract';
import { AuditService, type AuditTx } from '../audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ValidationException } from '../common/validation-exception';
import type { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { checkPattern } from './regex-validation';

const deptNotFound = () => new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.' });
const forbidden = () =>
  new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission for this department.' });
const ruleNotFound = () => new NotFoundException({ code: 'RULE_NOT_FOUND', message: 'Rule not found.' });

const BUNDLE_FORMAT = 2; // 2: policy entries carry risk_level

/** Weak-looking but safe: the ETag only identifies (version, department), never auth material. */
export function bundleETag(version: number, departmentId: string | null): string {
  // BUNDLE_FORMAT changes when the shape of the bundle changes without a policy write (a client then refetches).
  const hash = createHash('sha256').update(`${BUNDLE_FORMAT}:${version}:${departmentId ?? 'org'}`).digest('base64url').slice(0, 16);
  return `"p${version}-${hash}"`;
}

type RuleRow = Prisma.CustomRuleGetPayload<{ include: { customRuleDepartments: { select: { departmentId: true } } } }>;

function toRuleResponse(r: RuleRow, editable = true): CustomRuleResponse {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    definition: r.definition,
    risk_level: r.riskLevel,
    action: r.action,
    scope: r.scope,
    department_ids: r.customRuleDepartments.map((d) => d.departmentId).sort(),
    enabled: r.enabled,
    editable,
  };
}

/**
 * A Department Admin edits a rule only when it applies to their department alone, and, for a TOPIC rule, only
 * when they wrote it themselves (the description of a TOPIC rule written by a System Admin stays confidential, decision 30).
 */
function deptAdminMayEdit(row: RuleRow, res: CustomRuleResponse, actor: AuthUser): boolean {
  return onlyDepartment(res, actor.departmentId) && (row.kind !== 'TOPIC' || row.createdBy === actor.id);
}

/** A rule that applies to exactly one department. */
function onlyDepartment(r: { scope: string; department_ids: string[] }, departmentId: string | null): boolean {
  return r.scope === 'DEPARTMENTS' && r.department_ids.length === 1 && r.department_ids[0] === departmentId;
}

/**
 * Policy, custom rules and the versioned bundle (WEB-FR-034..042, 065, 069;
 * decisions 5, 6, 7, 14).
 *
 * Every write bumps the single global PolicyVersion in the SAME transaction as
 * the change and its audit entry, so the bundle version, the policy and the
 * audit trail can never disagree. A write that changes nothing bumps nothing.
 */
@Injectable()
export class PolicyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------- versions ----------

  async currentVersion(): Promise<number> {
    const row = await this.prisma.policyVersion.findUniqueOrThrow({ where: { id: 1 }, select: { version: true } });
    return row.version;
  }

  private async bump(tx: AuditTx): Promise<number> {
    const rows = await tx.$queryRaw<{ version: number }[]>`
      UPDATE "PolicyVersion" SET version = version + 1 WHERE id = 1 RETURNING version`;
    return rows[0].version;
  }

  // ---------- category policy ----------

  async orgPolicy(): Promise<OrgPolicyResponse> {
    const [version, items] = await this.prisma.$transaction(
      async (tx) => [await this.versionIn(tx), await this.effective(tx, null)] as const,
      { isolationLevel: 'RepeatableRead' },
    );
    return { version, items };
  }

  /** A System Admin may read any department; a Department Admin only their own (WEB-FR-069). */
  async departmentPolicy(actor: AuthUser, departmentId: string): Promise<DepartmentPolicyResponse> {
    this.requireOwnDepartment(actor, departmentId);
    const [version, items] = await this.prisma.$transaction(
      async (tx) => {
        await this.requireDepartment(tx, departmentId);
        return [await this.versionIn(tx), await this.effective(tx, departmentId)] as const;
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return { department_id: departmentId, version, items };
  }

  async setOrg(actor: AuthUser, category: CategoryCode, req: PolicyCategoryActionRequest): Promise<OrgPolicyResponse> {
    await this.writeCategory(actor, null, category, req);
    return this.orgPolicy();
  }

  async setDepartment(
    actor: AuthUser,
    departmentId: string,
    category: CategoryCode,
    req: PolicyCategoryActionRequest,
  ): Promise<DepartmentPolicyResponse> {
    this.requireOwnDepartment(actor, departmentId);
    await this.writeCategory(actor, departmentId, category, req);
    return this.departmentPolicy(actor, departmentId);
  }

  /** Remove a department override: the category falls back to the organisation value. */
  async clearDepartment(actor: AuthUser, departmentId: string, category: CategoryCode): Promise<DepartmentPolicyResponse> {
    this.requireOwnDepartment(actor, departmentId);
    await this.prisma.$transaction(async (tx) => {
      await this.requireDepartment(tx, departmentId);
      const removed = await tx.policyCategoryAction.deleteMany({ where: { departmentId, categoryCode: category } });
      if (removed.count === 0) return;
      const version = await this.bump(tx);
      await this.audit.recordIn(tx, {
        acting_admin_id: actor.id,
        action: 'POLICY_CHANGED',
        target_type: 'DEPARTMENT',
        target_id: departmentId,
        detail: { category_code: category, change: 'override_removed', version },
      });
    });
    return this.departmentPolicy(actor, departmentId);
  }

  private async writeCategory(
    actor: AuthUser,
    departmentId: string | null,
    category: CategoryCode,
    req: PolicyCategoryActionRequest,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (departmentId) await this.requireDepartment(tx, departmentId);
      // One policy writer at a time: two first-time writes of the same
      // (department, category) would otherwise race on the unique index.
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext('lock:policy-write'))) AS l`;
      const existing = await tx.policyCategoryAction.findFirst({
        where: { departmentId, categoryCode: category },
        select: { id: true, action: true, enabled: true },
      });
      if (existing && existing.action === req.action && existing.enabled === req.enabled) return;
      if (existing) {
        await tx.policyCategoryAction.update({
          where: { id: existing.id },
          data: { action: req.action, enabled: req.enabled },
        });
      } else {
        await tx.policyCategoryAction.create({
          data: { id: randomUUID(), departmentId, categoryCode: category, action: req.action, enabled: req.enabled },
        });
      }
      const version = await this.bump(tx);
      await this.audit.recordIn(tx, {
        acting_admin_id: actor.id,
        action: 'POLICY_CHANGED',
        target_type: departmentId ? 'DEPARTMENT' : 'POLICY',
        target_id: departmentId,
        detail: {
          category_code: category,
          action: req.action,
          enabled: req.enabled,
          ...(existing ? { old_action: existing.action, old_enabled: existing.enabled } : {}),
          version,
        },
      });
    });
  }

  // ---------- custom rules ----------

  /** System Admin: all rules. Department Admin: the rules that apply to their department (read-only). */
  async listRules(actor: AuthUser): Promise<CustomRuleListResponse> {
    const isDeptAdmin = actor.role === 'DEPARTMENT_ADMIN';
    const where: Prisma.CustomRuleWhereInput =
      actor.role === 'DEPARTMENT_ADMIN'
        ? {
            OR: [
              { scope: 'ORG_WIDE' },
              ...(actor.departmentId ? [{ customRuleDepartments: { some: { departmentId: actor.departmentId } } }] : []),
            ],
          }
        : {};
    const [version, rows] = await this.prisma.$transaction(
      async (tx) =>
        [
          await this.versionIn(tx),
          await tx.customRule.findMany({
            where,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            include: { customRuleDepartments: { select: { departmentId: true } } },
          }),
        ] as const,
      { isolationLevel: 'RepeatableRead' },
    );
    // A Department Admin sees only their own department among a rule's departments.
    const items = rows.map((r) => {
      const res = toRuleResponse(r);
      if (!isDeptAdmin) return res;
      // A Department Admin edits only rules that apply to their department alone. Every other rule is
      // read-only: only their own department is listed, and a TOPIC description (decision 30) is not sent.
      const editable = deptAdminMayEdit(r, res, actor);
      return {
        ...res,
        editable,
        definition: res.kind === 'TOPIC' && !editable ? '' : res.definition,
        department_ids: res.department_ids.filter((d) => d === actor.departmentId),
      };
    });
    return { version, items };
  }

  async createRule(actor: AuthUser, req: CustomRuleRequest): Promise<CustomRuleResponse> {
    this.requireOwnDepartmentRule(actor, req);
    const input = await this.normalizeRule(req);
    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await this.requireDepartments(tx, input.department_ids);
      // Rule and department links in ONE transaction: the deferred scope trigger
      // checks them together at commit.
      await tx.customRule.create({
        data: {
          id,
          createdBy: actor.id,
          kind: input.kind,
          name: input.name,
          definition: input.definition,
          riskLevel: input.risk_level,
          action: input.action,
          scope: input.scope,
          enabled: input.enabled,
        },
      });
      if (input.department_ids.length > 0) {
        await tx.customRuleDepartment.createMany({
          data: input.department_ids.map((departmentId) => ({ customRuleId: id, departmentId })),
        });
      }
      const version = await this.bump(tx);
      await this.recordRule(tx, actor, id, input, { change: 'created', version });
    });
    return this.getRule(id);
  }

  /** Full edit, including enable / disable (WEB-FR-038). Identical content is a quiet no-op. */
  async updateRule(actor: AuthUser, id: string, req: CustomRuleRequest): Promise<CustomRuleResponse> {
    this.requireOwnDepartmentRule(actor, req);
    const input = await this.normalizeRule(req);
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "CustomRule" WHERE id = ${id}::uuid FOR UPDATE`;
      if (locked.length === 0) throw ruleNotFound();
      const current = await tx.customRule.findUniqueOrThrow({
        where: { id },
        include: { customRuleDepartments: { select: { departmentId: true } } },
      });
      await this.requireDepartments(tx, input.department_ids);

      const before = toRuleResponse(current);
      if (actor.role === 'DEPARTMENT_ADMIN' && !deptAdminMayEdit(current, before, actor)) throw forbidden();
      const olds: Record<string, string | boolean> = {};
      if (before.action !== input.action) olds.old_action = before.action;
      if (before.risk_level !== input.risk_level) olds.old_risk_level = before.risk_level;
      if (before.enabled !== input.enabled) olds.old_enabled = before.enabled;
      const changed = (
        [
          ['name', before.name !== input.name],
          ['kind', before.kind !== input.kind],
          ['definition', before.definition !== input.definition],
          ['risk_level', before.risk_level !== input.risk_level],
          ['action', before.action !== input.action],
          ['scope', before.scope !== input.scope],
          ['departments', before.department_ids.join() !== [...input.department_ids].sort().join()],
          ['enabled', before.enabled !== input.enabled],
        ] as const
      )
        .filter(([, differs]) => differs)
        .map(([field]) => field);
      if (changed.length === 0) return;

      await tx.customRule.update({
        where: { id },
        data: {
          kind: input.kind,
          name: input.name,
          definition: input.definition,
          riskLevel: input.risk_level,
          action: input.action,
          scope: input.scope,
          enabled: input.enabled,
        },
      });
      if (changed.includes('departments') || changed.includes('scope')) {
        await tx.customRuleDepartment.deleteMany({ where: { customRuleId: id } });
        if (input.department_ids.length > 0) {
          await tx.customRuleDepartment.createMany({
            data: input.department_ids.map((departmentId) => ({ customRuleId: id, departmentId })),
          });
        }
      }
      const version = await this.bump(tx);
      await this.recordRule(tx, actor, id, input, { change: 'updated', changed_fields: [...changed], version, ...olds });
    });
    return this.getRule(id);
  }

  /** A Department Admin may only write a rule that applies to their own department alone. */
  private requireOwnDepartmentRule(actor: AuthUser, req: CustomRuleRequest): void {
    if (actor.role !== 'DEPARTMENT_ADMIN') return;
    if (!onlyDepartment(req, actor.departmentId)) throw forbidden();
  }

  private async getRule(id: string): Promise<CustomRuleResponse> {
    const row = await this.prisma.customRule.findUnique({
      where: { id },
      include: { customRuleDepartments: { select: { departmentId: true } } },
    });
    if (!row) throw ruleNotFound();
    return toRuleResponse(row);
  }

  /** Per-kind normalisation and the regex safety checks (WEB-FR-035, 036). */
  private async normalizeRule(req: CustomRuleRequest): Promise<CustomRuleRequest> {
    // A PATTERN is kept verbatim: trimming would change what the regex matches.
    let definition = req.kind === 'PATTERN' ? req.definition : req.definition.trim();
    if (req.kind === 'KEYWORD') definition = [...new Set(splitKeywords(req.definition))].join('\n');
    if (req.kind === 'PATTERN') {
      const check = await checkPattern(definition);
      if (!check.ok) throw new ValidationException({ definition: [check.error] });
    }
    return { ...req, definition, department_ids: [...req.department_ids] };
  }

  private recordRule(
    tx: AuditTx,
    actor: AuthUser,
    id: string,
    input: CustomRuleRequest,
    extra: Record<string, string | number | boolean | string[]>,
  ) {
    // Never the definition (it may be a pattern or an example text): decision 19.
    return this.audit.recordIn(tx, {
      acting_admin_id: actor.id,
      action: 'RULE_CHANGED',
      target_type: 'CUSTOM_RULE',
      target_id: id,
      detail: {
        name: input.name,
        kind: input.kind,
        risk_level: input.risk_level,
        action: input.action,
        scope: input.scope,
        enabled: input.enabled,
        department_count: input.department_ids.length,
        ...extra,
      },
    });
  }

  // ---------- extension bundle ----------

  /** The ETag for a user's bundle, from one cheap read (used for If-None-Match). */
  async etagFor(departmentId: string | null): Promise<{ etag: string; version: number }> {
    const version = await this.currentVersion();
    return { etag: bundleETag(version, departmentId), version };
  }

  /**
   * WEB-FR-042/070: one resolved policy (24 entries), the enabled rules that
   * apply to the user's department (or only org-wide rules without one), and
   * the version. Read in one snapshot so version and content always agree.
   * Carries no auth material.
   */
  async bundle(departmentId: string | null): Promise<{ body: PolicyBundleResponse; etag: string }> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const version = await this.versionIn(tx);
        const policy = (await this.effective(tx, departmentId)).map((e) => ({
          category_code: e.category_code,
          action: e.action,
          enabled: e.enabled,
          risk_level: e.default_risk_level,
        }));
        const rules = await tx.customRule.findMany({
          where: {
            enabled: true,
            OR: [
              { scope: 'ORG_WIDE' },
              ...(departmentId ? [{ customRuleDepartments: { some: { departmentId } } }] : []),
            ],
          },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true, kind: true, definition: true, riskLevel: true, action: true },
        });
        return { version, policy, rules };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    const body = PolicyBundleResponseSchema.parse({
      version: result.version,
      policy: result.policy,
      rules: result.rules.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        definition: r.definition,
        risk_level: r.riskLevel,
        action: r.action,
      })),
    });
    return { body, etag: bundleETag(result.version, departmentId) };
  }

  // ---------- helpers ----------

  /** A System Admin may act on any department; a Department Admin only on their own (WEB-FR-069). */
  private requireOwnDepartment(actor: AuthUser, departmentId: string): void {
    if (actor.role === 'DEPARTMENT_ADMIN' && actor.departmentId !== departmentId) throw forbidden();
  }

  private async versionIn(tx: AuditTx): Promise<number> {
    return (await tx.policyVersion.findUniqueOrThrow({ where: { id: 1 }, select: { version: true } })).version;
  }

  /** Effective value per category: department override > organisation value > built-in default. */
  private async effective(tx: AuditTx, departmentId: string | null): Promise<CategoryPolicyEntry[]> {
    const [categories, rows] = await Promise.all([
      tx.dataCategory.findMany({ select: { categoryCode: true, name: true, defaultRiskLevel: true } }),
      tx.policyCategoryAction.findMany({
        where: { OR: [{ departmentId: null }, ...(departmentId ? [{ departmentId }] : [])] },
        select: { departmentId: true, categoryCode: true, action: true, enabled: true },
      }),
    ]);
    const byCode = new Map(categories.map((c) => [c.categoryCode, c]));
    return CATEGORY_CODES.map((code): CategoryPolicyEntry => {
      const c = byCode.get(code);
      if (!c) throw new Error(`DataCategory ${code} is missing (seed not applied).`);
      const dept = departmentId ? rows.find((r) => r.departmentId === departmentId && r.categoryCode === code) : undefined;
      const org = rows.find((r) => r.departmentId === null && r.categoryCode === code);
      const chosen = dept ?? org;
      return {
        category_code: code,
        name: c.name,
        default_risk_level: c.defaultRiskLevel,
        action: chosen ? chosen.action : defaultActionFor(code, c.defaultRiskLevel),
        enabled: chosen ? chosen.enabled : true,
        source: dept ? 'DEPARTMENT' : org ? 'ORG' : 'DEFAULT',
      };
    });
  }

  private async requireDepartment(tx: AuditTx, id: string): Promise<void> {
    if ((await tx.department.count({ where: { id } })) === 0) throw deptNotFound();
  }

  private async requireDepartments(tx: AuditTx, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if ((await tx.department.count({ where: { id: { in: ids } } })) !== new Set(ids).size) throw deptNotFound();
  }
}
