import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { Role } from '@hares/contract';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { IngestionService } from '../ingestion/ingestion.service';
import { PolicyService } from '../policy/policy.service';
import type { PrismaClient } from '../prisma/generated/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DEV_PASSWORD, seedDevData, stableUuid, type DevSeedOptions, type DevSeedResult } from './dev-seed';

/**
 * Demo data for the GP2 report screenshots. Development only: the script that calls this refuses to run
 * in production or against a database that is not on localhost. Everything is synthetic.
 *
 * What it creates, on top of `seedDevData` (same deterministic generator, same ingestion path):
 *  - 3 departments (Engineering, Finance, Human Resources), 5 people each: 1 Department Admin and 4 Employees,
 *    plus the System Admin (`admin.demo@<domain>`) unless `withSystemAdmin` is false;
 *  - one registration waiting for approval (`pending.demo@<domain>`);
 *  - two department policies that differ from the default, set by the Department Admins of those departments
 *    (so the audit trail shows who changed what);
 *  - two custom rules, one PATTERN (Engineering) and one KEYWORD (Finance), also written by their Department Admins;
 *  - two TOPIC rules (decision 66): one in effect (Human Resources, with its English description, written by
 *    that department's admin) and one saved the old way without an English description (Finance), which the
 *    screens mark "not in effect" and the extension skips;
 *  - about 300 activity-log events over the last 30 days, plus 5 events matched by the TOPIC rule in effect
 *    (rule id, no category, LOCAL_AI), as the extension sends them.
 *
 * Re-running is safe: users and departments are found by name or e-mail, events keep their ids, an unchanged
 * policy writes nothing, and a rule is created only when no rule of that name exists.
 */

export const GP2_DEPARTMENTS = ['Engineering', 'Finance', 'Human Resources'] as const;

export interface Gp2DemoResult extends DevSeedResult {
  pending: string;
  policyChanges: number;
  rules: string[];
  /** Events matched by the TOPIC rule in effect that this run created (0 on a second run). */
  topicLogsCreated: number;
}

export const GP2_TOPIC_RULE = 'Demo layoff plans';
export const GP2_OLD_TOPIC_RULE = 'Demo old topic rule (no English description)';
const TOPIC_EVENTS = 5;

export async function seedGp2Demo(prisma: PrismaClient, opts: Pick<DevSeedOptions, 'domain' | 'namePrefix' | 'seed' | 'now' | 'withSystemAdmin'> = {}): Promise<Gp2DemoResult> {
  const domain = opts.domain ?? 'example.test';
  const prefix = opts.namePrefix ?? 'Demo ';
  const now = opts.now ?? new Date();

  const base = await seedDevData(prisma, {
    ...opts,
    domain,
    namePrefix: prefix,
    departments: GP2_DEPARTMENTS,
    usersPerDepartment: 5,
    daysBack: 30,
    eventsPerUserPerDay: 0.8,
    now,
  });

  // The registration waiting for the System Admin's approval: no role, no department.
  const pendingEmail = `pending.demo@${domain}`;
  if (!(await prisma.user.findFirst({ where: { email: { equals: pendingEmail, mode: 'insensitive' } } }))) {
    await prisma.user.create({
      data: {
        id: randomUUID(),
        fullName: 'Demo Pending Registrant',
        email: pendingEmail,
        passwordHash: await bcrypt.hash(DEV_PASSWORD, 12),
        status: 'PENDING',
        role: null,
        departmentId: null,
        registeredAt: now,
      },
    });
  }

  const policy = new PolicyService(prisma as unknown as PrismaService, new AuditService(prisma as unknown as PrismaService));
  const adminOf = async (slug: string): Promise<{ actor: AuthUser; departmentId: string }> => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `${slug}.admin@${domain}` } });
    const role: Role = 'DEPARTMENT_ADMIN';
    return { actor: { id: user.id, status: 'ACTIVE', role, departmentId: user.departmentId, client: 'web' }, departmentId: user.departmentId! };
  };

  // Two department policies that differ from the built-in default (default: HEALTH_MEDICAL blocks, CONTACT_INFO warns).
  const hr = await adminOf('human-resources');
  const finance = await adminOf('finance');
  const engineering = await adminOf('engineering');
  // Counted here, not from the global policy version: other writers (tests running at the same time) bump it too.
  let policyChanges = 0;
  const setPolicy = async (who: typeof hr, category: 'HEALTH_MEDICAL' | 'CONTACT_INFO', action: 'WARN' | 'ALLOW') => {
    const current = await prisma.policyCategoryAction.findFirst({ where: { departmentId: who.departmentId, categoryCode: category } });
    if (current?.action === action && current.enabled) return;
    await policy.setDepartment(who.actor, who.departmentId, category, { action, enabled: true });
    policyChanges++;
  };
  await setPolicy(hr, 'HEALTH_MEDICAL', 'WARN');
  await setPolicy(finance, 'CONTACT_INFO', 'ALLOW');

  // Two rules, each for the department of the administrator who wrote it.
  const rules: string[] = [];
  const ensureRule = async (who: typeof engineering, req: Parameters<PolicyService['createRule']>[1]) => {
    rules.push(req.name);
    if (await prisma.customRule.findFirst({ where: { name: req.name } })) return;
    await policy.createRule(who.actor, { ...req, scope: 'DEPARTMENTS', department_ids: [who.departmentId] });
  };
  await ensureRule(engineering, {
    name: 'Demo employee number',
    kind: 'PATTERN',
    definition: 'EMP-[0-9]{6}',
    risk_level: 'MEDIUM',
    action: 'WARN',
    scope: 'DEPARTMENTS',
    department_ids: [],
    enabled: true,
  });
  await ensureRule(finance, {
    name: 'Demo confidential projects',
    kind: 'KEYWORD',
    definition: 'project atlas\nquarterly forecast',
    risk_level: 'HIGH',
    action: 'BLOCK',
    scope: 'DEPARTMENTS',
    department_ids: [],
    enabled: true,
  });

  // A TOPIC rule as it was saved before decision 66: enabled, no English description. The API no longer accepts
  // that, so it is written directly (rule and department link in one transaction for the scope trigger), without
  // an audit entry, as the migration left such rules. It goes first: the version bump of the
  // API-written TOPIC rule below then covers it, so clients refetch (no extra bump of its own).
  rules.push(GP2_OLD_TOPIC_RULE);
  if (!(await prisma.customRule.findFirst({ where: { name: GP2_OLD_TOPIC_RULE } }))) {
    await prisma.$transaction(async (tx) => {
      const id = randomUUID();
      await tx.customRule.create({
        data: {
          id,
          createdBy: finance.actor.id,
          kind: 'TOPIC',
          name: GP2_OLD_TOPIC_RULE,
          definition: 'أي حديث عن ميزانية الربع القادم قبل اعتمادها',
          definitionEn: null,
          threshold: 0.3,
          riskLevel: 'MEDIUM',
          action: 'WARN',
          scope: 'DEPARTMENTS',
          enabled: true,
        },
      });
      await tx.customRuleDepartment.create({ data: { customRuleId: id, departmentId: finance.departmentId } });
    });
  }

  // A TOPIC rule in effect, written through the API like any other rule.
  await ensureRule(hr, {
    name: GP2_TOPIC_RULE,
    kind: 'TOPIC',
    definition: 'أي حديث عن خطط تسريح موظفين أو إلغاء وظائف أو إعادة هيكلة',
    definition_en: 'This text discusses layoffs, job cuts or restructuring.',
    threshold: 0.3,
    risk_level: 'MEDIUM',
    action: 'WARN',
    scope: 'DEPARTMENTS',
    department_ids: [],
    enabled: true,
  });

  // Events matched by the TOPIC rule in effect, sent by Human Resources employees as the extension sends them:
  // the rule id, no category, LOCAL_AI. Stable ids, so a second run adds nothing.
  const topicRule = await prisma.customRule.findFirstOrThrow({ where: { name: GP2_TOPIC_RULE } });
  const ingestion = new IngestionService(prisma as unknown as PrismaService);
  const decisions = ['EDITED', 'CANCELLED', 'SUBMITTED_ANYWAY', 'EDITED', 'CANCELLED'] as const;
  let topicLogsCreated = 0;
  for (let i = 0; i < TOPIC_EVENTS; i++) {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `human-resources.user${(i % 4) + 1}@${domain}` } });
    const day = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const eventTime = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 8 + i, 15, 0));
    const res = await ingestion.ingest({ id: user.id, departmentId: user.departmentId } as unknown as AuthUser, {
      log_id: stableUuid(`gp2-topic:${domain}:${i}`),
      event_time: eventTime.toISOString(),
      platform: (['CHATGPT', 'GEMINI', 'CLAUDE'] as const)[i % 3],
      risk_level: 'MEDIUM',
      action: 'WARNED',
      categories: [],
      classification_source: 'LOCAL_AI',
      user_decision: decisions[i],
      rule_id: topicRule.id,
      schema_version: 1,
    }, now);
    if (res.created) topicLogsCreated++;
  }

  return { ...base, pending: pendingEmail, policyChanges, rules, topicLogsCreated };
}
