import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Database-level guard rails. These exercise the RAW SQL objects that Prisma
// cannot express: case-insensitive / NULLS NOT DISTINCT unique indexes, CHECK
// constraints, immutability triggers and the deferred CustomRule scope guard.
//
// SYNTHETIC DATA ONLY: every write runs inside a transaction that is rolled
// back (or aborted by a deliberately violated constraint). Nothing persists.
// The test database is intentionally empty, so no real data is touched.
// NOTE: the spec expects a FRESHLY MIGRATED (empty) database for this suite.
// Inline email literals are salted per run so they never collide with rows a
// previous run may have left behind.
// ---------------------------------------------------------------------------

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://hares:hares@localhost:5432/hares',
});

function id(): string {
  return randomUUID();
}

/** Per-run salt so inline email literals never collide with leftovers from an earlier run. */
const RUN_SALT = randomUUID().replace(/-/g, '').slice(0, 12);
function uniqEmail(tag: string): string {
  return `${tag}-${RUN_SALT}@synthetic.local`;
}

/** Run a callback inside a BEGIN/ROLLBACK transaction. */
async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
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

/** Minimal shape of a PostgreSQL error we assert on. */
interface PgGuardError {
  code?: string;
  constraint?: string;
  message: string;
}

function isPgGuardError(e: unknown): e is PgGuardError {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

/**
 * Run a callback that is EXPECTED to make PostgreSQL raise. Returns the error.
 * The callback should end with the violating statement (or SET CONSTRAINTS
 * IMMEDIATE for deferred guard triggers).
 */
async function violating<T>(run: (c: PoolClient) => Promise<T>): Promise<PgGuardError> {
  let err: unknown;
  try {
    await withTx(run);
  } catch (e) {
    err = e;
  }
  if (!err) throw new Error('Expected the statement to fail, but it succeeded.');
  if (!isPgGuardError(err)) {
    throw new Error('Expected the statement to fail with a PostgreSQL error.');
  }
  return err;
}

// --- synthetic seeders (all inside the caller's transaction) ----------------

async function seedUser(c: PoolClient, opts: {
  email?: string; status?: string; role?: string; departmentId?: string;
} = {}): Promise<string> {
  const userId = id();
  await c.query(
    `insert into "User" (id, full_name, email, password_hash, status, role, department_id, registered_at)
     values ($1, $2, $3, $4, $5::user_status, $6::role, $7, now())
     returning id`,
    [
      userId,
      'Synthetic User',
      opts.email ?? `${userId}@synthetic.local`,
      'x',
      opts.status ?? 'PENDING',
      opts.role ?? null,
      opts.departmentId ?? null,
    ],
  );
  return userId;
}

async function seedDepartment(c: PoolClient, name: string): Promise<string> {
  const dId = id();
  await c.query(`insert into "Department" (id, name) values ($1, $2)`, [dId, name]);
  return dId;
}

async function seedCategory(c: PoolClient): Promise<string> {
  const code = `SYN_${randomUUID().replace(/-/g, '')}`;
  await c.query(
    `insert into "DataCategory" (category_code, name, default_risk_level)
     values ($1, $2, 'LOW'::risk_level)`,
    [code, 'Synthetic Category'],
  );
  return code;
}

async function seedUserActive(c: PoolClient): Promise<string> {
  return seedUser(c, { status: 'ACTIVE', role: 'SYSTEM_ADMIN' });
}

// ---------------------------------------------------------------------------

describe('raw objects created by the four migrations are present', () => {
  let present: { indexes: string[]; triggers: string[]; checks: string[] };

  beforeAll(async () => {
    const c = await pool.connect();
    try {
      const idx = await c.query(
        `select indexname from pg_indexes where schemaname = 'public' order by indexname`,
      );
      const trig = await c.query(
        `select t.tgname
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where not t.tgisinternal and n.nspname = 'public'
         order by t.tgname`,
      );
      const chk = await c.query(
        `select conname from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace order by conname`,
      );
      present = {
        indexes: idx.rows.map((r) => r.indexname),
        triggers: trig.rows.map((r) => r.tgname),
        checks: chk.rows.map((r) => r.conname),
      };
    } finally {
      c.release();
    }
  });

  it('registers the 5 raw unique indexes', () => {
    for (const idx of [
      'uq_user_email_lower',
      'uq_department_name_lower',
      'uq_policy_category_action',
      'uq_event_counter',
      'uq_category_counter',
    ]) {
      expect(present.indexes, idx).toContain(idx);
    }
  });

  it('registers the immutability + scope-guard triggers', () => {
    for (const trig of [
      'trg_admin_audit_log_no_update',
      'trg_admin_audit_log_no_delete',
      'trg_admin_audit_log_no_truncate',
      'trg_activity_log_no_update',
      'trg_custom_rule_scope_insert_update',
      'trg_custom_rule_scope_department_changes',
    ]) {
      expect(present.triggers, trig).toContain(trig);
    }
  });

  it('registers the CHECK constraints', () => {
    const expected = [
      'chk_user_status_role',
      'chk_user_role_department',
      'chk_event_counter_event_count',
      'chk_category_counter_event_count',
      'chk_activity_log_schema_version',
      'chk_policy_version_id',
      'chk_policy_version_version',
      'chk_custom_rule_pattern_length',
      'chk_custom_rule_nonpattern_length',
      'chk_custom_rule_definition_nonempty',
      'chk_admin_audit_log_target',
      'chk_refresh_token_expires',
      'chk_password_reset_token_expires',
    ];
    for (const chk of expected) {
      expect(present.checks, chk).toContain(chk);
    }
  });
});

// ---------------------------------------------------------------------------

describe('CHECK constraints reject bad data', () => {
  it('chk_user_status_role: ACTIVE requires a role', async () => {
    const e = await violating((c) =>
      c.query(
        `insert into "User" (id, full_name, email, password_hash, status, role, registered_at)
         values ($1, $2, $3, 'x', 'ACTIVE'::user_status, NULL::role, now())`,
        [id(), 'Bad User', uniqEmail('bad-activerole')],
      ),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_user_status_role');
  });

  it('chk_user_status_role: a PENDING user with a role is rejected', async () => {
    const e = await violating((c) =>
      c.query(
        `insert into "User" (id, full_name, email, password_hash, status, role, registered_at)
         values ($1, $2, $3, 'x', 'PENDING'::user_status, 'SYSTEM_ADMIN'::role, now())`,
        [id(), 'Bad User', uniqEmail('bad-pending-role')],
      ),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_user_status_role');
  });

  it('chk_user_role_department: a department-scoped role needs a department', async () => {
    const e = await violating((c) =>
      c.query(
        `insert into "User" (id, full_name, email, password_hash, status, role, department_id, registered_at)
         values ($1, $2, $3, 'x', 'ACTIVE'::user_status, 'DEPARTMENT_ADMIN'::role, NULL, now())`,
        [id(), 'Bad User', uniqEmail('bad-dept')],
      ),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_user_role_department');
  });

  it('chk_user_role_department: an ACTIVE user with role USER and no department is rejected', async () => {
    const e = await violating((c) =>
      c.query(
        `insert into "User" (id, full_name, email, password_hash, status, role, department_id, registered_at)
         values ($1, $2, $3, 'x', 'ACTIVE'::user_status, 'USER'::role, NULL, now())`,
        [id(), 'Bad User', uniqEmail('bad-user-role')],
      ),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_user_role_department');
  });

  it('chk_event_counter_event_count: negative count is rejected', async () => {
    const e = await violating((c) =>
      c.query(
        `insert into "EventCounter" (id, day, platform, risk_level, action, user_decision, event_count)
         values ($1, current_date, 'CHATGPT'::platform, 'LOW'::risk_level, 'ALLOWED'::log_action, 'NONE'::user_decision, -1)`,
        [id()],
      ),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_event_counter_event_count');
  });

  it('chk_category_counter_event_count: negative count is rejected', async () => {
    const e = await violating(async (c) => {
      const cat = await seedCategory(c);
      await c.query(
        `insert into "CategoryCounter" (id, day, department_id, platform, category_code, risk_level, event_count)
         values ($1, current_date, NULL, 'CHATGPT'::platform, $2, 'LOW'::risk_level, -1)`,
        [id(), cat],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_category_counter_event_count');
  });


  it('chk_activity_log_schema_version: schema_version >= 1', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "ActivityLog" (log_id, user_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
         values ($1, $2, 'CHATGPT'::platform, 'LOW'::risk_level, 'ALLOWED'::log_action, 'LOCAL'::classification_source, 'NONE'::user_decision, 0, now(), now())`,
        [id(), uid],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_activity_log_schema_version');
  });

  it('chk_policy_version_id: only id = 1 is allowed', async () => {
    const e = await violating((c) =>
      c.query(`insert into "PolicyVersion" (id, version) values (2, 1)`, []),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_policy_version_id');
  });

  it('chk_policy_version_version: version >= 1', async () => {
    const e = await violating((c) =>
      c.query(`insert into "PolicyVersion" (id, version) values (1, 0)`, []),
    );
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_policy_version_version');
  });

  it('chk_custom_rule_pattern_length: a PATTERN rule longer than 512 is rejected', async () => {
    const def = 'a'.repeat(600);
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'PATTERN'::rule_kind, 'synthetic', $3, 'LOW'::risk_level, 'BLOCK'::policy_action, 'ORG_WIDE'::rule_scope)`,
        [id(), uid, def],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_custom_rule_pattern_length');
  });

  it('chk_custom_rule_nonpattern_length: a non-PATTERN rule longer than 4000 is rejected', async () => {
    const def = 'a'.repeat(4001);
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', $3, 'LOW'::risk_level, 'BLOCK'::policy_action, 'ORG_WIDE'::rule_scope)`,
        [id(), uid, def],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_custom_rule_nonpattern_length');
  });

  it('chk_custom_rule_definition_nonempty: empty definition is rejected', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', '', 'LOW'::risk_level, 'BLOCK'::policy_action, 'ORG_WIDE'::rule_scope)`,
        [id(), uid],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_custom_rule_definition_nonempty');
  });

  it('chk_admin_audit_log_target: a non-POLICY target needs a target_id', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUserActive(c);
      await c.query(
        `insert into "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id)
         values ($1, $2, 'USER_APPROVED'::audit_action_type, 'USER'::target_type, NULL)`,
        [id(), uid],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_admin_audit_log_target');
  });

  it('chk_refresh_token_expires: expires_at must be after created_at', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "RefreshToken" (id, user_id, token_hash, family_id, token_version, expires_at)
         values ($1, $2, $3, $4, 0, now() - interval '1 hour')`,
        [id(), uid, `hash-${randomUUID()}`, id()],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_refresh_token_expires');
  });

  it('chk_password_reset_token_expires: expires_at must be after created_at', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "PasswordResetToken" (id, user_id, token_hash, expires_at)
         values ($1, $2, $3, now() - interval '1 hour')`,
        [id(), uid, `hash-${randomUUID()}`],
      );
    });
    expect(e.code).toBe('23514');
    expect(e.constraint).toBe('chk_password_reset_token_expires');
  });
});

describe('CHECK constraints accept valid data', () => {
  it('chk_user_role_department: an ACTIVE SYSTEM_ADMIN with no department is accepted', async () => {
    await withTx(async (c) => {
      await seedUserActive(c);
    });
  });
});

// ---------------------------------------------------------------------------

describe('raw unique indexes reject duplicates', () => {
  it('uq_user_email_lower: case-insensitive uniqueness on email', async () => {
    const e = await violating(async (c) => {
      await seedUser(c, { email: uniqEmail('Synthetic.User') });
      await seedUser(c, { email: uniqEmail('synthetic.user') });
    });
    expect(e.code).toBe('23505');
    expect(e.constraint).toBe('uq_user_email_lower');
  });

  it('uq_department_name_lower: case-insensitive uniqueness on name', async () => {
    const e = await violating(async (c) => {
      await seedDepartment(c, 'Sales');
      await seedDepartment(c, 'sales');
    });
    expect(e.code).toBe('23505');
    expect(e.constraint).toBe('uq_department_name_lower');
  });

  it('uq_policy_category_action: NULL department_id is treated as a duplicate (NULLS NOT DISTINCT)', async () => {
    const e = await violating(async (c) => {
      const cat = await seedCategory(c);
      const stmt = `insert into "PolicyCategoryAction" (id, department_id, category_code, action)
                    values ($1, NULL, $2, 'ALLOW'::policy_action)`;
      await c.query(stmt, [id(), cat]);
      await c.query(stmt, [id(), cat]);
    });
    expect(e.code).toBe('23505');
    expect(e.constraint).toBe('uq_policy_category_action');
  });

  it('uq_event_counter: duplicate key with NULL department/rule is rejected (NULLS NOT DISTINCT)', async () => {
    const e = await violating(async (c) => {
      const stmt = `insert into "EventCounter" (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
                    values ($1, current_date, NULL, 'CHATGPT'::platform, 'LOW'::risk_level, 'ALLOWED'::log_action, 'NONE'::user_decision, NULL, 0)`;
      await c.query(stmt, [id()]);
      await c.query(stmt, [id()]);
    });
    expect(e.code).toBe('23505');
    expect(e.constraint).toBe('uq_event_counter');
  });

  it('uq_category_counter: duplicate key with NULL department is rejected (NULLS NOT DISTINCT)', async () => {
    const e = await violating(async (c) => {
      const cat = await seedCategory(c);
      const stmt = `insert into "CategoryCounter" (id, day, department_id, platform, category_code, risk_level, event_count)
                    values ($1, current_date, NULL, 'CHATGPT'::platform, $2, 'LOW'::risk_level, 0)`;
      await c.query(stmt, [id(), cat]);
      await c.query(stmt, [id(), cat]);
    });
    expect(e.code).toBe('23505');
    expect(e.constraint).toBe('uq_category_counter');
  });
});

// ---------------------------------------------------------------------------

describe('immutability guards (append-only tables)', () => {
  it('AdminAuditLog: UPDATE is rejected', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUserActive(c);
      const auditId = id();
      await c.query(
        `insert into "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id)
         values ($1, $2, 'USER_APPROVED'::audit_action_type, 'USER'::target_type, $3)`,
        [auditId, uid, uid],
      );
      await c.query(`update "AdminAuditLog" set detail = '{"x":1}'::jsonb where id = $1`, [auditId]);
    });
    expect(e.message).toContain('append-only');
  });

  it('AdminAuditLog: DELETE is rejected', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUserActive(c);
      const auditId = id();
      await c.query(
        `insert into "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id)
         values ($1, $2, 'USER_APPROVED'::audit_action_type, 'USER'::target_type, $3)`,
        [auditId, uid, uid],
      );
      await c.query(`delete from "AdminAuditLog" where id = $1`, [auditId]);
    });
    expect(e.message).toContain('append-only');
  });

  it('AdminAuditLog: TRUNCATE is rejected', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUserActive(c);
      await c.query(
        `insert into "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id)
         values ($1, $2, 'USER_APPROVED'::audit_action_type, 'USER'::target_type, $3)`,
        [id(), uid, uid],
      );
      await c.query(`truncate table "AdminAuditLog"`);
    });
    expect(e.message).toContain('append-only');
  });

  it('ActivityLog: UPDATE is rejected (immutable after insert)', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      const logId = id();
      await c.query(
        `insert into "ActivityLog" (log_id, user_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
         values ($1, $2, 'CHATGPT'::platform, 'LOW'::risk_level, 'ALLOWED'::log_action, 'LOCAL'::classification_source, 'NONE'::user_decision, 1, now(), now())`,
        [logId, uid],
      );
      await c.query(`update "ActivityLog" set schema_version = 2 where log_id = $1`, [logId]);
    });
    expect(e.message).toContain('immutable');
  });

  it('ActivityLog: DELETE is permitted and cascades to LogCategory', async () => {
    await withTx(async (c) => {
      const uid = await seedUser(c);
      const logId = id();
      const catA = await seedCategory(c);
      const catB = await seedCategory(c);
      await c.query(
        `insert into "ActivityLog" (log_id, user_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
         values ($1, $2, 'CHATGPT'::platform, 'LOW'::risk_level, 'ALLOWED'::log_action, 'LOCAL'::classification_source, 'NONE'::user_decision, 1, now(), now())`,
        [logId, uid],
      );
      await c.query(
        `insert into "LogCategory" (log_id, category_code) values ($1, $2), ($1, $3)`,
        [logId, catA, catB],
      );
      const before = await c.query(
        `select count(*)::int as n from "LogCategory" where log_id = $1`,
        [logId],
      );
      expect(before.rows[0].n).toBe(2);
      await c.query(`delete from "ActivityLog" where log_id = $1`, [logId]);
      const after = await c.query(
        `select count(*)::int as n from "LogCategory" where log_id = $1`,
        [logId],
      );
      expect(after.rows[0].n).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------

describe('CustomRule scope guard (deferred constraint triggers)', () => {
  // Force the DEFERRABLE INITIALLY DEFERRED triggers to fire within the
  // transaction so we can assert on the violation and roll back cleanly.
  const fire = 'SET CONSTRAINTS ALL IMMEDIATE';

  it('rejects DEPARTMENTS scope with no linked department', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'DEPARTMENTS'::rule_scope)`,
        [id(), uid],
      );
      await c.query(fire);
    });
    expect(e.message).toContain('linked to no department');
  });

  it('rejects ORG_WIDE scope with a linked department', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      const ruleId = id();
      const deptId = await seedDepartment(c, 'ScopeDept');
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'ORG_WIDE'::rule_scope)`,
        [ruleId, uid],
      );
      await c.query(
        `insert into "CustomRuleDepartment" (custom_rule_id, department_id) values ($1, $2)`,
        [ruleId, deptId],
      );
      await c.query(fire);
    });
    expect(e.message).toContain('linked to department');
  });

  it('accepts DEPARTMENTS scope with a linked department', async () => {
    await withTx(async (c) => {
      const uid = await seedUser(c);
      const ruleId = id();
      const deptId = await seedDepartment(c, 'ScopeDept2');
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'DEPARTMENTS'::rule_scope)`,
        [ruleId, uid],
      );
      await c.query(
        `insert into "CustomRuleDepartment" (custom_rule_id, department_id) values ($1, $2)`,
        [ruleId, deptId],
      );
      await c.query(fire); // must not throw
    });
  });

  it('accepts ORG_WIDE scope with no linked department', async () => {
    await withTx(async (c) => {
      const uid = await seedUser(c);
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'ORG_WIDE'::rule_scope)`,
        [id(), uid],
      );
      await c.query(fire); // must not throw
    });
  });
  it('rejects moving a CustomRuleDepartment row out of a DEPARTMENTS rule at commit', async () => {
    const e = await violating(async (c) => {
      const uid = await seedUser(c);
      const ruleA = id();
      const ruleB = id();
      const deptA = await seedDepartment(c, 'MoveDeptA');
      const deptB = await seedDepartment(c, 'MoveDeptB');
      // Rule A: DEPARTMENTS, linked only to deptA.
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'DEPARTMENTS'::rule_scope)`,
        [ruleA, uid],
      );
      await c.query(
        `insert into "CustomRuleDepartment" (custom_rule_id, department_id) values ($1, $2)`,
        [ruleA, deptA],
      );
      // Rule B is DEPARTMENTS too and already has deptB, so it stays valid after
      // it gains deptA. Only the OLD rule (A) is left invalid, which is exactly
      // the case the previous implementation (which only checked NEW) missed.
      await c.query(
        `insert into "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope)
         values ($1, $2, 'KEYWORD'::rule_kind, 'synthetic', 'def', 'LOW'::risk_level, 'BLOCK'::policy_action, 'DEPARTMENTS'::rule_scope)`,
        [ruleB, uid],
      );
      await c.query(
        `insert into "CustomRuleDepartment" (custom_rule_id, department_id) values ($1, $2)`,
        [ruleB, deptB],
      );
      // Pre-flight: consume the deferred insert events while ruleA and ruleB are
      // still valid, so the move below is validated only by the
      // department-changes trigger (the path the fix targets) and not by the
      // CustomRule insert/update trigger.
      await c.query(fire);
      // Move the (ruleA, deptA) association onto ruleB.
      await c.query(
        `update "CustomRuleDepartment" set custom_rule_id = $1
         where custom_rule_id = $2 and department_id = $3`,
        [ruleB, ruleA, deptA],
      );
      await c.query(fire);
    });
    expect(e.message).toContain('linked to no department');
  });
});

afterAll(async () => {
  await pool.end();
});
