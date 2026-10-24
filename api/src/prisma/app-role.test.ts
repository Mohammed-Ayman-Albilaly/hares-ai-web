import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Application-role privilege suite.
//
// This connects AS the application runtime role (APP_DATABASE_URL) and proves
// the least-privilege posture set up by api/db/roles.sql +
// ops/revoke-audit-privileges.sql:
//   * it can read and write rows: INSERT + SELECT on the append-only
//     AdminAuditLog, and it can build a DEPARTMENTS CustomRule together with
//     its department links in one transaction. The scope-guard trigger reads
//     CustomRule / CustomRuleDepartment, so it must NOT raise a permission
//     error — this is why the role is granted SELECT on those tables.
//   * it cannot UPDATE, DELETE or TRUNCATE the append-only AdminAuditLog.
//   * it cannot run DDL (ALTER / DROP) on any table.
//
// SYNTHETIC DATA ONLY: every write is inside a transaction that is rolled back
// (or aborted by the deliberately denied statement). Nothing persists.
//
// The suite is skipped (with a message) when APP_DATABASE_URL is not configured.
// ---------------------------------------------------------------------------

const appUrl = process.env.APP_DATABASE_URL;
if (!appUrl) {
  console.warn(
    '[app-role] APP_DATABASE_URL is not set — skipping the hares_app privilege suite.',
  );
}

const pool = appUrl ? new Pool({ connectionString: appUrl }) : null;

const RUN_SALT = randomUUID().replace(/-/g, '').slice(0, 12);
function id(): string {
  return randomUUID();
}
function uniqEmail(tag: string): string {
  return `${tag}-${RUN_SALT}@synthetic.local`;
}
function uniqName(tag: string): string {
  return `${tag} ${RUN_SALT}`;
}

/** Run a callback inside a BEGIN/ROLLBACK transaction on the app-role pool. */
async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('APP_DATABASE_URL is not set; pool is unavailable.');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await fn(c);
    await c.query('ROLLBACK');
    return result;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

interface PgError {
  code?: string;
  message: string;
}
function isPgError(e: unknown): e is PgError {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

/** Run a callback that is EXPECTED to be denied by PostgreSQL. Returns the error. */
async function violating<T>(run: (c: PoolClient) => Promise<T>): Promise<PgError> {
  let err: unknown;
  try {
    await withTx(run);
  } catch (e) {
    err = e;
  }
  if (!err) throw new Error('Expected the statement to fail, but it succeeded.');
  if (!isPgError(err)) throw new Error('Expected a PostgreSQL error.');
  return err;
}

// --- synthetic seeders (all inside the caller's transaction) ----------------

/** A PENDING user (no role, no department) satisfies both User CHECK constraints. */
async function seedPendingUser(c: PoolClient): Promise<string> {
  const userId = id();
  await c.query(
    `insert into "User" (id, full_name, email, password_hash, status, role, department_id, registered_at)
     values ($1, $2, $3, 'x', 'PENDING'::user_status, NULL::role, NULL, now())
     returning id`,
    [userId, 'App Role Synthetic', uniqEmail('app-role-user')],
  );
  return userId;
}

async function seedDepartment(c: PoolClient, name: string): Promise<string> {
  const deptId = id();
  await c.query(`insert into "Department" (id, name) values ($1, $2)`, [deptId, name]);
  return deptId;
}

async function seedAuditLog(c: PoolClient, actingAdminId: string): Promise<string> {
  const auditId = id();
  await c.query(
    `insert into "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id)
     values ($1, $2, 'USER_APPROVED'::audit_action_type, 'USER'::target_type, $2)
     returning id`,
    [auditId, actingAdminId],
  );
  return auditId;
}

// ---------------------------------------------------------------------------

describe.skipIf(!appUrl)('hares_app runtime role (APP_DATABASE_URL)', () => {
  it('can INSERT into and SELECT from AdminAuditLog', async () => {
    await withTx(async (c) => {
      const uid = await seedPendingUser(c);
      const auditId = await seedAuditLog(c, uid);
      const sel = await c.query(`select id from "AdminAuditLog" where id = $1`, [auditId]);
      expect(sel.rows).toHaveLength(1);
      expect(sel.rows[0].id).toBe(auditId);
    });
  });

  it('cannot UPDATE AdminAuditLog (permission denied)', async () => {
    const e = await violating(async (c) => {
      const uid = await seedPendingUser(c);
      const auditId = await seedAuditLog(c, uid);
      await c.query(`update "AdminAuditLog" set detail = '{}'::jsonb where id = $1`, [auditId]);
    });
    expect(e.code).toBe('42501');
  });

  it('cannot DELETE AdminAuditLog (permission denied)', async () => {
    const e = await violating(async (c) => {
      const uid = await seedPendingUser(c);
      const auditId = await seedAuditLog(c, uid);
      await c.query(`delete from "AdminAuditLog" where id = $1`, [auditId]);
    });
    expect(e.code).toBe('42501');
  });

  it('cannot TRUNCATE AdminAuditLog (permission denied)', async () => {
    const e = await violating(async (c) => {
      await c.query(`truncate table "AdminAuditLog"`);
    });
    expect(e.code).toBe('42501');
  });

  it('cannot ALTER a table (permission denied)', async () => {
    const e = await violating(async (c) => {
      await c.query(`alter table "CustomRule" add column app_role_probe int`);
    });
    expect(e.code).toBe('42501');
  });

  it('cannot DROP a table (permission denied)', async () => {
    const e = await violating(async (c) => {
      await c.query(`drop table "CustomRule"`);
    });
    expect(e.code).toBe('42501');
  });

  it('can create a DEPARTMENTS CustomRule plus its department links (scope guard does not raise permission denied)', async () => {
    await withTx(async (c) => {
      const uid = await seedPendingUser(c);
      const deptId = await seedDepartment(c, uniqName('App Role Dept'));
      const ruleId = id();
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'app-role synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'DEPARTMENTS'::rule_scope)`,
        [ruleId, uid],
      );
      await c.query(
        `insert into "CustomRuleDepartment" (custom_rule_id, department_id) values ($1, $2)`,
        [ruleId, deptId],
      );
      // Force the DEFERRABLE scope-guard triggers to fire now. If the role
      // lacked SELECT on CustomRule / CustomRuleDepartment the trigger function
      // would raise 42501; this must complete cleanly.
      await c.query('SET CONSTRAINTS ALL IMMEDIATE');
    });
  });
});

afterAll(async () => {
  if (pool) await pool.end();
});
