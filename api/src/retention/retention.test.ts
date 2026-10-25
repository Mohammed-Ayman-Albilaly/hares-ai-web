import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TokenService } from '../auth/token.service';
import { JobsService } from '../jobs/jobs.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';
import { PurgeService } from './purge.service';
import { ReconcileService } from './reconcile.service';

// Counter reconcile, retention purge and the jobs (B8). Runs in the per-run
// test database. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[retention] database not configured — skipping.');

describe.skipIf(!dbEnabled)('reconcile and purge (B8)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let dept: string;
  let user: { id: string };
  let ext: string;

  const sql = async (text: string, params: unknown[] = []) => (await fx.owner.query(text, params)).rows;
  const eventTotal = async (platform: string) =>
    Number((await sql(`SELECT COALESCE(sum(event_count),0)::int AS n FROM "EventCounter" WHERE department_id = $1 AND platform = $2::platform`, [dept, platform]))[0].n);
  const categoryTotal = async (platform: string, category: string) =>
    Number((await sql(`SELECT COALESCE(sum(event_count),0)::int AS n FROM "CategoryCounter" WHERE department_id = $1 AND platform = $2::platform AND category_code = $3`, [dept, platform, category]))[0].n);
  const post = (over: Record<string, unknown>) =>
    t.call('POST', '/api/logs', {
      bearer: ext,
      body: {
        log_id: randomUUID(),
        event_time: new Date().toISOString(),
        platform: 'CLAUDE',
        risk_level: 'HIGH',
        action: 'BLOCKED',
        categories: ['CONTACT_INFO'],
        classification_source: 'LOCAL',
        user_decision: 'NONE',
        schema_version: 1,
        ...over,
      },
    });
  /** Insert an activity log directly (older than ingestion would accept). */
  async function insertOld(daysAgo: number, platform: string): Promise<string> {
    const id = randomUUID();
    await fx.owner.query(
      `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
       VALUES ($1, $2, $3, $4::platform, 'LOW', 'ALLOWED', 'LOCAL', 'NONE', 1, now() - ($5 || ' days')::interval, now())`,
      [id, user.id, dept, platform, String(daysAgo)],
    );
    await fx.owner.query(`INSERT INTO "LogCategory" (log_id, category_code) VALUES ($1, 'DATES_TIME')`, [id]);
    return id;
  }

  beforeAll(async () => {
    fx = new Fixtures();
    dept = await fx.department('Ret');
    user = await fx.user('r-user', { role: 'USER', departmentId: dept });
    t = await bootTestApp();
    ext = await t.app.get(TokenService).signAccess({ sub: user.id, tv: 0 }, 'extension');
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  // ---------- reconcile ----------

  it('repairs drifted counters: lost increments, phantom counts and missing rows', async () => {
    await post({ platform: 'CLAUDE', categories: ['CONTACT_INFO'] });
    await post({ platform: 'CLAUDE', categories: ['CONTACT_INFO'] });
    await post({ platform: 'CLAUDE', categories: ['CONTACT_INFO'], risk_level: 'LOW', action: 'ALLOWED' });
    expect(await eventTotal('CLAUDE')).toBe(3);

    // Drift 1: a counter lost an increment. Drift 2: a phantom counter with no logs. Drift 3: a missing counter row.
    await fx.owner.query(`UPDATE "EventCounter" SET event_count = 1 WHERE department_id = $1 AND platform = 'CLAUDE' AND risk_level = 'HIGH'`, [dept]);
    await fx.owner.query(`UPDATE "CategoryCounter" SET event_count = 9 WHERE department_id = $1 AND platform = 'CLAUDE' AND category_code = 'CONTACT_INFO' AND risk_level = 'HIGH'`, [dept]);
    await fx.owner.query(`INSERT INTO "EventCounter" (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
      VALUES (gen_random_uuid(), now()::date, $1, 'CLAUDE', 'MEDIUM', 'WARNED', 'NONE', NULL, 7)`, [dept]);
    await fx.owner.query(`DELETE FROM "EventCounter" WHERE department_id = $1 AND platform = 'CLAUDE' AND risk_level = 'LOW'`, [dept]);

    const result = await t.app.get(ReconcileService).reconcile();
    expect(result.eventRowsFixed).toBeGreaterThanOrEqual(3);
    expect(await eventTotal('CLAUDE')).toBe(3);
    expect(await categoryTotal('CLAUDE', 'CONTACT_INFO')).toBe(3);
    const phantom = await sql(`SELECT event_count::int AS n FROM "EventCounter" WHERE department_id = $1 AND platform = 'CLAUDE' AND risk_level = 'MEDIUM'`, [dept]);
    expect(phantom.map((r) => r.n)).toEqual([0]);
  });

  it('a second run changes nothing (idempotent) and does not disturb other departments', async () => {
    const other = await fx.department('Ret Other');
    await fx.owner.query(`INSERT INTO "EventCounter" (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
      VALUES (gen_random_uuid(), '2000-01-01', $1, 'CHATGPT', 'LOW', 'ALLOWED', 'NONE', NULL, 5)`, [other]);
    const snapshot = async () =>
      await sql(`SELECT day::text, platform::text, risk_level::text, action::text, event_count::int AS n FROM "EventCounter" WHERE department_id = $1 ORDER BY 1, 2, 3, 4`, [dept]);
    const before = await snapshot();
    await t.app.get(ReconcileService).reconcile();
    expect(await snapshot()).toEqual(before); // nothing in this department changed on a second run
    // A counter for a day behind the retention boundary is the only record: it is never touched.
    const old = await sql(`SELECT event_count::int AS n FROM "EventCounter" WHERE department_id = $1`, [other]);
    expect(old).toEqual([{ n: 5 }]);
  });

  it('forced interleaving: reconcile waits for an in-flight ingestion and then counts its row', async () => {
    const client = await fx.owner.connect();
    const id = randomUUID();
    try {
      await client.query('BEGIN');
      // An ingestion transaction that has already written its counters (holds the row locks).
      await client.query(
        `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
         VALUES ($1, $2, $3, 'CHATGPT', 'MEDIUM', 'WARNED', 'LOCAL', 'EDITED', 1, now(), now())`,
        [id, user.id, dept],
      );
      await client.query(
        `INSERT INTO "EventCounter" (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
         VALUES (gen_random_uuid(), (now() AT TIME ZONE 'UTC')::date, $1, 'CHATGPT', 'MEDIUM', 'WARNED', 'EDITED', NULL, 1)
         ON CONFLICT (day, department_id, platform, risk_level, action, user_decision, rule_id) DO UPDATE SET event_count = "EventCounter".event_count + 1`,
        [dept],
      );
      let done = false;
      const run = t.app.get(ReconcileService).reconcile().then((r) => {
        done = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 600));
      expect(done).toBe(false); // blocked by the uncommitted ingestion
      await client.query('COMMIT');
      await run;
    } finally {
      client.release();
    }
    const [row] = await sql(
      `SELECT event_count::int AS n FROM "EventCounter" WHERE department_id = $1 AND platform = 'CHATGPT' AND risk_level = 'MEDIUM' AND action = 'WARNED' AND user_decision = 'EDITED' AND day = (now() AT TIME ZONE 'UTC')::date`,
      [dept],
    );
    expect(row.n).toBe(1); // one row, counted once: not lost, not doubled
  });

  it('concurrent ingestion during a reconcile ends consistent (no lost increments)', async () => {
    const before = await eventTotal('GEMINI');
    const burst = Array.from({ length: 20 }, () => post({ platform: 'GEMINI', categories: ['LOCATION'] }));
    const runs = [t.app.get(ReconcileService).reconcile(), t.app.get(ReconcileService).reconcile()];
    const results = await Promise.all([...burst, ...runs]);
    expect(results.slice(0, 20).every((r) => (r as { status: number }).status === 201)).toBe(true);
    const logs = Number((await sql(`SELECT count(*)::int AS n FROM "ActivityLog" WHERE department_id = $1 AND platform = 'GEMINI'`, [dept]))[0].n);
    expect(logs).toBe(20);
    expect(await eventTotal('GEMINI')).toBe(before + 20);
    expect(await categoryTotal('GEMINI', 'LOCATION')).toBe(20);
  });

  // ---------- purge ----------

  it('deletes only detail rows older than 90 days; counters and the audit trail stay', async () => {
    const oldId = await insertOld(95, 'CHATGPT');
    const edgeId = await insertOld(89, 'CHATGPT');
    const fresh = await insertOld(1, 'CHATGPT');
    await fx.owner.query(`INSERT INTO "EventCounter" (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
      VALUES (gen_random_uuid(), (now() - interval '95 days')::date, $1, 'CHATGPT', 'LOW', 'ALLOWED', 'NONE', NULL, 4)`, [dept]);
    const sa = await fx.user('r-sa', { role: 'SYSTEM_ADMIN' });
    await t.app.get(PurgeService); // resolved
    const oldAudit = randomUUID();
    await fx.owner.query(`INSERT INTO "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id, created_at)
      VALUES ($1, $2, 'USER_APPROVED', 'USER', $2, now() - interval '400 days')`, [oldAudit, sa.id]);
    const counterBefore = await eventTotal('CHATGPT');

    const result = await t.app.get(PurgeService).purge();
    expect(result?.activityLogs).toBeGreaterThanOrEqual(1);
    const left = await sql(`SELECT log_id FROM "ActivityLog" WHERE log_id = ANY($1::uuid[])`, [[oldId, edgeId, fresh]]);
    expect(left.map((r) => r.log_id).sort()).toEqual([edgeId, fresh].sort());
    expect((await sql(`SELECT count(*)::int AS n FROM "LogCategory" WHERE log_id = $1`, [oldId]))[0].n).toBe(0);
    expect(await eventTotal('CHATGPT')).toBe(counterBefore);
    // The 400-day-old audit entry is still there (other suites write audit rows in parallel, so no global count).
    expect((await sql(`SELECT 1 FROM "AdminAuditLog" WHERE id = $1`, [oldAudit])).length).toBe(1);
  });

  it('purges in batches (more rows than one batch) and a reconcile afterwards leaves old counters alone', async () => {
    await fx.owner.query(
      `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
       SELECT gen_random_uuid(), $1, $2, 'GEMINI', 'NONE', 'ALLOWED', 'LOCAL', 'NONE', 1, now() - interval '120 days' - (g || ' seconds')::interval, now()
         FROM generate_series(1, 5200) g`,
      [user.id, dept],
    );
    const result = await t.app.get(PurgeService).purge();
    expect(result?.activityLogs).toBeGreaterThanOrEqual(5200);
    expect(Number((await sql(`SELECT count(*)::int AS n FROM "ActivityLog" WHERE event_time < now() - interval '90 days'`))[0].n)).toBe(0);
    const oldCounter = async () =>
      Number((await sql(`SELECT COALESCE(sum(event_count),0)::int AS n FROM "EventCounter" WHERE department_id = $1 AND platform = 'CHATGPT' AND day = (now() - interval '95 days')::date`, [dept]))[0].n);
    expect(await oldCounter()).toBe(4);
    await t.app.get(ReconcileService).reconcile();
    // The 95-day-old counter has no detail rows left behind it and is the only record: untouched.
    expect(await oldCounter()).toBe(4);
  });

  it('also clears stale login-attempt rows and long-expired tokens, keeping live ones', async () => {
    await fx.owner.query(`INSERT INTO "LoginAttempt" (key, key_type, failure_count, window_start, next_allowed_at)
      VALUES ('stale-' || $1, 'ACCOUNT', 3, now() - interval '3 days', NULL), ('live-' || $1, 'ACCOUNT', 9, now() - interval '3 days', now() + interval '10 minutes')`, [fx.salt]);
    await t.app.get(PurgeService).purge();
    const keys = (await sql(`SELECT key FROM "LoginAttempt" WHERE key LIKE '%' || $1`, [fx.salt])).map((r) => r.key);
    expect(keys).toEqual([`live-${fx.salt}`]);
    await fx.owner.query(`DELETE FROM "LoginAttempt" WHERE key LIKE '%' || $1`, [fx.salt]);
  });

  // ---------- jobs ----------

  it('the job runners complete without throwing (scheduled-job smoke run)', async () => {
    const jobs = t.app.get(JobsService);
    await expect(jobs.runReconcile()).resolves.toBeUndefined();
    await expect(jobs.runPurge()).resolves.toBeUndefined();
  });
});
