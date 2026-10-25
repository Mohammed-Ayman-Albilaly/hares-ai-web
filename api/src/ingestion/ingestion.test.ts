import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { LogIngestionResponseSchema } from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';
import { IngestionRateLimiter } from './ingestion-rate-limiter';

// Metadata-only ingestion (B7a): strict allowlist, identity from the token,
// idempotency, counters incremented once, department/user blocks, limits.
// Runs in the per-run test database. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[ingestion] database not configured — skipping.');

describe.skipIf(!dbEnabled)('log ingestion (B7a)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let deptId: string;
  let user: { id: string };
  let admin: { id: string };
  let ext: string;
  let extAdmin: string;
  let webToken: string;

  const event = (over: Record<string, unknown> = {}) => ({
    log_id: randomUUID(),
    event_time: new Date().toISOString(),
    platform: 'CHATGPT',
    risk_level: 'HIGH',
    action: 'BLOCKED',
    categories: ['CONTACT_INFO', 'FINANCIAL_BANKING'],
    classification_source: 'LOCAL',
    user_decision: 'NONE',
    schema_version: 1,
    ...over,
  });
  const post = (body: unknown, bearer = ext) => t.call('POST', '/api/logs', { bearer, body });
  const sql = async (text: string, params: unknown[] = []) => (await fx.owner.query(text, params)).rows;

  const eventCount = async (dept: string | null, extra = '') =>
    Number(
      (
        await sql(
          `SELECT COALESCE(sum(event_count), 0)::int AS n FROM "EventCounter" WHERE department_id IS NOT DISTINCT FROM $1 ${extra}`,
          [dept],
        )
      )[0].n,
    );

  beforeAll(async () => {
    fx = new Fixtures();
    deptId = await fx.department('Ing');
    user = await fx.user('i-user', { role: 'USER', departmentId: deptId });
    admin = await fx.user('i-sa', { role: 'SYSTEM_ADMIN' });
    t = await bootTestApp();
    const tokens = t.app.get(TokenService);
    ext = await tokens.signAccess({ sub: user.id, tv: 0 }, 'extension');
    extAdmin = await tokens.signAccess({ sub: admin.id, tv: 0 }, 'extension');
    webToken = await tokens.signAccess({ sub: user.id, tv: 0 }, 'web');
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  // ---------- happy path and idempotency ----------

  it('stores a new event (201) with identity from the token and a department snapshot', async () => {
    const e = event();
    const res = await post(e);
    expect(res.status).toBe(201);
    expect(LogIngestionResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.log_id).toBe(e.log_id);

    const [row] = await sql('SELECT user_id, department_id, platform, risk_level, action, rule_id, schema_version FROM "ActivityLog" WHERE log_id = $1', [e.log_id]);
    expect(row).toMatchObject({ user_id: user.id, department_id: deptId, platform: 'CHATGPT', risk_level: 'HIGH', action: 'BLOCKED', rule_id: null, schema_version: 1 });
    const cats = await sql('SELECT category_code FROM "LogCategory" WHERE log_id = $1 ORDER BY category_code', [e.log_id]);
    expect(cats.map((c) => c.category_code)).toEqual(['CONTACT_INFO', 'FINANCIAL_BANKING']);
  });

  it('a duplicate log_id is acknowledged (200) and counted exactly once', async () => {
    const e = event({ platform: 'GEMINI', categories: ['LOCATION'] });
    const before = await eventCount(deptId, `AND platform = 'GEMINI'`);
    expect((await post(e)).status).toBe(201);
    expect((await post(e)).status).toBe(200);
    expect((await post(e)).status).toBe(200);
    expect(await eventCount(deptId, `AND platform = 'GEMINI'`)).toBe(before + 1);
    expect((await sql('SELECT count(*)::int AS n FROM "ActivityLog" WHERE log_id = $1', [e.log_id]))[0].n).toBe(1);
    expect((await sql('SELECT count(*)::int AS n FROM "LogCategory" WHERE log_id = $1', [e.log_id]))[0].n).toBe(1);
  });

  it('concurrent posts of the same log_id: one 201, the rest 200, counters +1', async () => {
    const e = event({ platform: 'CLAUDE', risk_level: 'LOW', action: 'ALLOWED', categories: ['DATES_TIME'] });
    const before = await eventCount(deptId, `AND platform = 'CLAUDE' AND risk_level = 'LOW'`);
    const results = await Promise.all([post(e), post(e), post(e), post(e)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
    expect(await eventCount(deptId, `AND platform = 'CLAUDE' AND risk_level = 'LOW'`)).toBe(before + 1);
  });

  it('increments the event counter and one category counter per category', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const cc = async () =>
      Number(
        (
          await sql(
            `SELECT COALESCE(sum(event_count),0)::int AS n FROM "CategoryCounter"
              WHERE department_id = $1 AND platform = 'CHATGPT' AND risk_level = 'MEDIUM' AND day = $2 AND category_code = ANY($3)`,
            [deptId, day, ['VEHICLE', 'WEB_LINKS']],
          )
        )[0].n,
      );
    const before = await cc();
    await post(event({ risk_level: 'MEDIUM', action: 'WARNED', categories: ['VEHICLE', 'WEB_LINKS'], user_decision: 'EDITED' }));
    expect(await cc()).toBe(before + 2);
  });

  it('events with the same categories in opposite order never deadlock on the shared counters', async () => {
    const batch = Array.from({ length: 12 }, (_, i) =>
      event({
        platform: 'GEMINI',
        risk_level: 'LOW',
        action: i % 2 === 0 ? 'ALLOWED' : 'WARNED',
        categories: i % 2 === 0 ? ['VEHICLE', 'WEB_LINKS', 'LOCATION'] : ['LOCATION', 'WEB_LINKS', 'VEHICLE'],
      }),
    );
    const results = await Promise.all(batch.map((e) => post(e)));
    expect(results.map((r) => r.status)).toEqual(batch.map(() => 201));
    const day = new Date().toISOString().slice(0, 10);
    const rows = await sql(
      `SELECT category_code, event_count::int AS n FROM "CategoryCounter"
        WHERE department_id = $1 AND platform = 'GEMINI' AND risk_level = 'LOW' AND day = $2
          AND category_code IN ('VEHICLE', 'WEB_LINKS', 'LOCATION') ORDER BY category_code`,
      [deptId, day],
    );
    expect(rows.map((r) => r.n)).toEqual([12, 12, 12]);
  });

  it('an unsupported schema_version wins over other errors; a missing one is a plain validation error', async () => {
    expect((await post(event({ schema_version: 2, risk_level: 'EXTREME' }))).body.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
    const missing = event();
    delete (missing as Record<string, unknown>).schema_version;
    expect((await post(missing)).body.code).toBe('VALIDATION_ERROR');
    expect((await post(event({ schema_version: 'one' }))).body.code).toBe('VALIDATION_ERROR');
  });

  it('a NONE-risk event with no categories is logged and counted (decision 10)', async () => {
    const before = await eventCount(deptId, `AND risk_level = 'NONE'`);
    const res = await post(event({ risk_level: 'NONE', action: 'ALLOWED', categories: [] }));
    expect(res.status).toBe(201);
    expect(await eventCount(deptId, `AND risk_level = 'NONE'`)).toBe(before + 1);
  });

  it('a System Admin without a department is stored with a null department (WEB-FR-064)', async () => {
    const e = event({ platform: 'CLAUDE', categories: ['LOCATION'] });
    const before = await eventCount(null);
    expect((await post(e, extAdmin)).status).toBe(201);
    const [row] = await sql('SELECT department_id FROM "ActivityLog" WHERE log_id = $1', [e.log_id]);
    expect(row.department_id).toBeNull();
    expect(await eventCount(null)).toBe(before + 1);
    // The same key again (NULL department) goes into the same counter row.
    await post(event({ platform: 'CLAUDE', categories: ['LOCATION'] }), extAdmin);
    expect(await eventCount(null)).toBe(before + 2);
    expect((await sql(`SELECT count(*)::int AS n FROM "EventCounter" WHERE department_id IS NULL AND platform = 'CLAUDE' AND risk_level = 'HIGH' AND action = 'BLOCKED'`))[0].n).toBe(1);
  });

  // ---------- strict allowlist ----------

  it.each([
    ['prompt', 'my secret prompt text'],
    ['prompt_text', 'x'],
    ['user_id', randomUUID()],
    ['department_id', randomUUID()],
    ['masked_prompt', 'x'],
  ])('rejects the non-allowlisted field %s (400 UNKNOWN_FIELD), stores nothing, echoes nothing', async (field, value) => {
    const e = event({ [field]: value });
    const res = await post(e);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_FIELD');
    expect(res.body.details.accepted_fields).toContain('log_id');
    expect(res.text).not.toContain(String(value));
    expect(res.text).not.toContain(field);
    expect((await sql('SELECT count(*)::int AS n FROM "ActivityLog" WHERE log_id = $1', [e.log_id]))[0].n).toBe(0);
  });

  it('rejects invalid enum values with the accepted values (INVALID_ENUM) and unsupported schema versions', async () => {
    const bad = await post(event({ risk_level: 'EXTREME' }));
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_ENUM');
    expect(bad.body.details.risk_level[0]).toContain('HIGH');
    expect(bad.text).not.toContain('EXTREME');

    const cat = await post(event({ categories: ['NOT_A_CATEGORY'] }));
    expect(cat.body.code).toBe('INVALID_ENUM');

    const version = await post(event({ schema_version: 2 }));
    expect(version.status).toBe(400);
    expect(version.body.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
    expect(version.body.details.supported_schema_versions).toEqual(['1']);
  });

  it('rejects missing or malformed fields (VALIDATION_ERROR) without echoing values', async () => {
    const missing = event();
    delete (missing as Record<string, unknown>).platform;
    const a = await post(missing);
    expect(a.status).toBe(400);
    expect(a.body.code).toBe('VALIDATION_ERROR');
    const b = await post(event({ log_id: 'not-a-uuid-xyz' }));
    expect(b.body.code).toBe('VALIDATION_ERROR');
    expect(b.text).not.toContain('not-a-uuid-xyz');
    expect((await post(event({ categories: ['LOCATION', 'LOCATION'] }))).body.code).toBe('VALIDATION_ERROR');
    expect((await post(event({ event_time: 'yesterday' }))).body.code).toBe('VALIDATION_ERROR');
    expect((await t.call('POST', '/api/logs', { bearer: ext, rawBody: '{"log_id": ', headers: { 'content-type': 'application/json' } })).body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown rule_id and accepts a real one', async () => {
    const unknown = await post(event({ rule_id: randomUUID() }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.details.rule_id).toEqual(['rule.unknown']);

    const sa = await fx.user('i-rule-sa', { role: 'SYSTEM_ADMIN' });
    const ruleId = randomUUID();
    await fx.owner.query(
      `INSERT INTO "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope, enabled)
       VALUES ($1, $2, 'KEYWORD', 'ing rule', 'abc', 'LOW', 'WARN', 'ORG_WIDE', true)`,
      [ruleId, sa.id],
    );
    const ok = await post(event({ rule_id: ruleId }));
    expect(ok.status).toBe(201);
    expect((await sql('SELECT count(*)::int AS n FROM "EventCounter" WHERE rule_id = $1', [ruleId]))[0].n).toBe(1);
  });

  // ---------- event_time ----------

  it('enforces the event_time window: +5 min future and 90 days old', async () => {
    const at = (ms: number) => new Date(Date.now() + ms).toISOString();
    expect((await post(event({ event_time: at(4 * 60_000) }))).status).toBe(201);
    const future = await post(event({ event_time: at(6 * 60_000) }));
    expect(future.status).toBe(400);
    expect(future.body.code).toBe('EVENT_TIME_OUT_OF_RANGE');
    expect((await post(event({ event_time: at(-89 * 86_400_000) }))).status).toBe(201);
    const old = await post(event({ event_time: at(-91 * 86_400_000) }));
    expect(old.body.code).toBe('EVENT_TIME_OUT_OF_RANGE');
  });

  it('counts an old event on the UTC day of its event_time', async () => {
    const when = new Date(Date.now() - 30 * 86_400_000);
    const day = when.toISOString().slice(0, 10);
    const before = Number((await sql(`SELECT COALESCE(sum(event_count),0)::int AS n FROM "EventCounter" WHERE department_id = $1 AND day = $2`, [deptId, day]))[0].n);
    await post(event({ event_time: when.toISOString() }));
    const after = Number((await sql(`SELECT COALESCE(sum(event_count),0)::int AS n FROM "EventCounter" WHERE department_id = $1 AND day = $2`, [deptId, day]))[0].n);
    expect(after).toBe(before + 1);
  });

  // ---------- auth, revocation, blocks ----------

  it('401 without a token, with a web token, and after revocation', async () => {
    expect((await t.call('POST', '/api/logs', { body: event() })).status).toBe(401);
    expect((await post(event(), webToken)).status).toBe(401);

    const gone = await fx.user('i-gone', { role: 'USER', departmentId: deptId });
    const token = await t.app.get(TokenService).signAccess({ sub: gone.id, tv: 0 }, 'extension');
    expect((await post(event(), token)).status).toBe(201);
    await fx.owner.query(`UPDATE "User" SET status = 'DEACTIVATED', token_version = token_version + 1 WHERE id = $1`, [gone.id]);
    const res = await post(event(), token);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REVOKED');
  });

  it('403 DEPARTMENT_INACTIVE once the department is deactivated, nothing stored or counted', async () => {
    const dept = await fx.department('Ing Off');
    const member = await fx.user('i-off', { role: 'USER', departmentId: dept });
    const token = await t.app.get(TokenService).signAccess({ sub: member.id, tv: 0 }, 'extension');
    expect((await post(event(), token)).status).toBe(201);

    await fx.owner.query('UPDATE "Department" SET active = false WHERE id = $1', [dept]);
    const before = await eventCount(dept);
    const e = event();
    const res = await post(e, token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DEPARTMENT_INACTIVE');
    expect(await eventCount(dept)).toBe(before);
    expect((await sql('SELECT count(*)::int AS n FROM "ActivityLog" WHERE log_id = $1', [e.log_id]))[0].n).toBe(0);
  });

  // ---------- limits ----------

  it('413 for an oversized body', async () => {
    const res = await post(event({ categories: [], padding: 'x'.repeat(9000) }));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('per-user limit: 429 RATE_LIMITED with Retry-After, other users unaffected', async () => {
    const limiter = t.app.get(IngestionRateLimiter);
    const heavy = await fx.user('i-heavy', { role: 'USER', departmentId: deptId });
    const token = await t.app.get(TokenService).signAccess({ sub: heavy.id, tv: 0 }, 'extension');
    for (let i = 0; i < 120; i++) expect(limiter.take(heavy.id)).toBe(0);
    const res = await post(event(), token);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect((await post(event())).status).toBe(201);
  });

  it('the limiter resets after its window', () => {
    const limiter = new IngestionRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(limiter.take('u', t0, 5)).toBe(0);
    expect(limiter.take('u', t0 + 1000, 5)).toBeGreaterThan(0);
    expect(limiter.take('u', t0 + 61_000, 5)).toBe(0);
  });
});
