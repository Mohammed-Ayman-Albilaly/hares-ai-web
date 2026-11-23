import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { Role } from '@hares/contract';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { PolicyService } from '../policy/policy.service';
import type { PrismaClient } from '../prisma/generated/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DEV_PASSWORD, seedDevData, type DevSeedOptions, type DevSeedResult } from './dev-seed';

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
 *  - about 300 activity-log events over the last 30 days.
 *
 * Re-running is safe: users and departments are found by name or e-mail, events keep their ids, an unchanged
 * policy writes nothing, and a rule is created only when no rule of that name exists.
 */

export const GP2_DEPARTMENTS = ['Engineering', 'Finance', 'Human Resources'] as const;

export interface Gp2DemoResult extends DevSeedResult {
  pending: string;
  policyChanges: number;
  rules: string[];
}

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
  const before = await policy.currentVersion();
  await policy.setDepartment(hr.actor, hr.departmentId, 'HEALTH_MEDICAL', { action: 'WARN', enabled: true });
  await policy.setDepartment(finance.actor, finance.departmentId, 'CONTACT_INFO', { action: 'ALLOW', enabled: true });
  const policyChanges = (await policy.currentVersion()) - before;

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

  return { ...base, pending: pendingEmail, policyChanges, rules };
}
