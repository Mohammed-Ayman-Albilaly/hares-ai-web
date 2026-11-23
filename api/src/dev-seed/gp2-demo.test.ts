import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../prisma/generated/client';
import { testPool } from '../test/global-setup';
import { dbEnabled, ownerUrl } from '../test/http-test-app';
import { seedGp2Demo } from './gp2-demo';

// GP2 demo data (P6): what the report's screenshots need. Runs in the per-run test database. SYNTHETIC DATA ONLY.

describe.skipIf(!dbEnabled)('GP2 demo seed', () => {
  const salt = randomUUID().slice(0, 8);
  const domain = `gp2-${salt}.test`;
  const prefix = `Gp2 ${salt} `;
  let prisma: PrismaClient;
  let owner: Pool;
  const like = `${prefix}%`;
  const sql = async (text: string, params: unknown[] = []) => (await owner.query(text, params)).rows;
  const inDepts = `SELECT id FROM "Department" WHERE name LIKE $1`;

  beforeAll(() => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: ownerUrl }) });
    owner = testPool({ connectionString: ownerUrl });
  });

  afterAll(async () => {
    // The audit trail is append-only and its foreign key to User is RESTRICT, so the throwaway database
    // (dropped by the global setup at the end of the run) is what really cleans up; this removes the rest
    // so the other suites that share the database see no extra departments or logs.
    const rules = `SELECT id FROM "CustomRule" WHERE name LIKE 'Demo %' AND created_by IN (SELECT id FROM "User" WHERE email LIKE $1)`;
    await owner.query(`DELETE FROM "ActivityLog" WHERE department_id IN (${inDepts})`, [like]);
    await owner.query(`DELETE FROM "EventCounter" WHERE department_id IN (${inDepts})`, [like]);
    await owner.query(`DELETE FROM "CategoryCounter" WHERE department_id IN (${inDepts})`, [like]);
    // A DEPARTMENTS rule must always have a department link (checked when the transaction commits), so the links
    // and the rules go in one transaction.
    await owner.query('BEGIN');
    await owner.query(`DELETE FROM "CustomRuleDepartment" WHERE custom_rule_id IN (${rules})`, [`%@${domain}`]);
    await owner.query(`DELETE FROM "CustomRule" WHERE id IN (${rules})`, [`%@${domain}`]);
    await owner.query('COMMIT');
    await owner.query(`DELETE FROM "PolicyCategoryAction" WHERE department_id IN (${inDepts})`, [like]);
    await owner.end();
    await prisma.$disconnect();
  });

  it('creates what the screenshots need, and a second run adds nothing', async () => {
    const first = await seedGp2Demo(prisma, { domain, namePrefix: prefix, withSystemAdmin: false });

    expect(Number((await sql(`SELECT count(*) c FROM "Department" WHERE name LIKE $1`, [like]))[0].c)).toBe(3);
    const roles = await sql(`SELECT role, count(*)::int n FROM "User" WHERE email LIKE $1 AND status = 'ACTIVE' GROUP BY role`, [`%@${domain}`]);
    expect(Object.fromEntries(roles.map((r) => [r.role, r.n]))).toEqual({ DEPARTMENT_ADMIN: 3, USER: 12 });
    const pending = await sql(`SELECT status, role, department_id FROM "User" WHERE email = $1`, [`pending.demo@${domain}`]);
    expect(pending).toEqual([{ status: 'PENDING', role: null, department_id: null }]);

    // Department policies that differ from the default, with the audit entries of the administrators who set them.
    const overrides = await sql(`SELECT category_code, action FROM "PolicyCategoryAction" WHERE department_id IN (${inDepts}) ORDER BY category_code`, [like]);
    expect(overrides).toEqual([
      { category_code: 'CONTACT_INFO', action: 'ALLOW' },
      { category_code: 'HEALTH_MEDICAL', action: 'WARN' },
    ]);
    expect(first.policyChanges).toBe(2);

    const rules = await sql(`SELECT kind, scope FROM "CustomRule" WHERE name LIKE 'Demo %' AND created_by IN (SELECT id FROM "User" WHERE email LIKE $1) ORDER BY kind`, [`%@${domain}`]);
    expect(rules).toEqual([
      { kind: 'PATTERN', scope: 'DEPARTMENTS' }, // enum order: PATTERN, KEYWORD, TOPIC
      { kind: 'KEYWORD', scope: 'DEPARTMENTS' },
    ]);

    // The changes are in the audit trail under the names of the Department Admins who made them.
    const audit = await sql(
      `SELECT action_type, count(*)::int n FROM "AdminAuditLog" WHERE acting_admin_id IN (SELECT id FROM "User" WHERE email LIKE $1) GROUP BY action_type ORDER BY action_type`,
      [`%@${domain}`],
    );
    expect(audit).toEqual([
      { action_type: 'POLICY_CHANGED', n: 2 },
      { action_type: 'RULE_CHANGED', n: 2 },
    ]);

    // About 300 events over 30 days: several platforms, all risk levels, all user decisions.
    const logs = await sql(
      `SELECT count(*)::int n, count(DISTINCT platform)::int platforms, count(DISTINCT risk_level)::int risks, count(DISTINCT user_decision)::int decisions,
              max(event_time) - min(event_time) AS span
         FROM "ActivityLog" WHERE department_id IN (${inDepts})`,
      [like],
    );
    expect(logs[0].n).toBeGreaterThanOrEqual(250);
    expect(logs[0].n).toBeLessThanOrEqual(350);
    expect(logs[0].platforms).toBe(3);
    expect(logs[0].risks).toBe(4); // HIGH, MEDIUM, LOW and NONE
    expect(logs[0].decisions).toBe(5);
    expect(logs[0].span.days).toBeGreaterThanOrEqual(27);
    expect(logs[0].span.days).toBeLessThanOrEqual(30);

    const again = await seedGp2Demo(prisma, { domain, namePrefix: prefix, withSystemAdmin: false });
    expect(again.logsCreated).toBe(0);
    expect(again.policyChanges).toBe(0);
    expect(Number((await sql(`SELECT count(*) c FROM "CustomRule" WHERE name LIKE 'Demo %' AND created_by IN (SELECT id FROM "User" WHERE email LIKE $1)`, [`%@${domain}`]))[0].c)).toBe(2);
  });
});
