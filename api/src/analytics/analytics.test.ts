import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DashboardSummaryResponseSchema, DashboardTimeseriesResponseSchema, TopRiskyUsersResponseSchema } from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';

// Dashboards (B8): totals come from the counters written at ingestion, scoped
// by role. Events are posted through the real ingestion endpoint, so the test
// proves the whole path. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[analytics] database not configured — skipping.');

describe.skipIf(!dbEnabled)('dashboards (B8)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let deptA: string;
  let deptB: string;
  const tok = {} as Record<'saWeb' | 'daA' | 'userA' | 'userB' | 'extA1' | 'extA2' | 'extB', string>;

  const ev = (over: Record<string, unknown> = {}) => ({
    log_id: randomUUID(),
    event_time: new Date().toISOString(),
    platform: 'CHATGPT',
    risk_level: 'HIGH',
    action: 'BLOCKED',
    categories: ['CONTACT_INFO'],
    classification_source: 'LOCAL',
    user_decision: 'NONE',
    schema_version: 1,
    ...over,
  });
  const send = async (bearer: string, over: Record<string, unknown> = {}) => {
    const res = await t.call('POST', '/api/logs', { bearer, body: ev(over) });
    expect(res.status).toBe(201);
  };
  const get = (path: string, bearer: string) => t.call('GET', path, { bearer });

  beforeAll(async () => {
    fx = new Fixtures();
    deptA = await fx.department('Dash A');
    deptB = await fx.department('Dash B');
    const sa = await fx.user('d-sa', { role: 'SYSTEM_ADMIN' });
    const da = await fx.user('d-da', { role: 'DEPARTMENT_ADMIN', departmentId: deptA });
    const a1 = await fx.user('d-a1', { role: 'USER', departmentId: deptA });
    const a2 = await fx.user('d-a2', { role: 'USER', departmentId: deptA });
    const b1 = await fx.user('d-b1', { role: 'USER', departmentId: deptB });
    t = await bootTestApp();
    const s = t.app.get(TokenService);
    tok.saWeb = await s.signAccess({ sub: sa.id, tv: 0 }, 'web');
    tok.daA = await s.signAccess({ sub: da.id, tv: 0 }, 'web');
    tok.userA = await s.signAccess({ sub: a1.id, tv: 0 }, 'web');
    tok.userB = await s.signAccess({ sub: b1.id, tv: 0 }, 'web');
    tok.extA1 = await s.signAccess({ sub: a1.id, tv: 0 }, 'extension');
    tok.extA2 = await s.signAccess({ sub: a2.id, tv: 0 }, 'extension');
    tok.extB = await s.signAccess({ sub: b1.id, tv: 0 }, 'extension');

    // Department A: 6 events. Department B: 2 events.
    await send(tok.extA1, { risk_level: 'HIGH', action: 'BLOCKED', platform: 'CHATGPT', categories: ['CONTACT_INFO', 'FINANCIAL_BANKING'] });
    await send(tok.extA1, { risk_level: 'HIGH', action: 'BLOCKED', platform: 'CHATGPT', categories: ['CONTACT_INFO'], user_decision: 'SUBMITTED_ANYWAY' });
    await send(tok.extA1, { risk_level: 'MEDIUM', action: 'WARNED', platform: 'GEMINI', categories: ['LOCATION'] });
    await send(tok.extA2, { risk_level: 'MEDIUM', action: 'WARNED', platform: 'GEMINI', categories: ['LOCATION'], user_decision: 'EDITED' });
    await send(tok.extA2, { risk_level: 'LOW', action: 'ALLOWED', platform: 'CLAUDE', categories: ['DATES_TIME'] });
    await send(tok.extA2, { risk_level: 'NONE', action: 'ALLOWED', platform: 'CLAUDE', categories: [] });
    await send(tok.extB, { risk_level: 'HIGH', action: 'BLOCKED', platform: 'CLAUDE', categories: ['VEHICLE'] });
    await send(tok.extB, { risk_level: 'NONE', action: 'ALLOWED', platform: 'CLAUDE', categories: [] });
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  it('department summary: totals from the counters, platforms and categories, scoped to the department', async () => {
    const res = await get('/api/dashboard/department/summary', tok.daA);
    expect(res.status).toBe(200);
    expect(DashboardSummaryResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.scope).toBe('DEPARTMENT');
    expect(res.body.totals).toEqual({
      total_events: 6,
      intercepted: 4,
      blocked: 2,
      warned: 2,
      allowed: 2,
      high_risk: 2,
      high_risk_percent: 33.3,
      override_rate_percent: 25, // 1 of 4 intercepted events submitted anyway
    });
    expect(res.body.total_users).toBe(3); // the admin and the two users
    expect(res.body.platforms).toEqual([
      { platform: 'CHATGPT', count: 2 },
      { platform: 'CLAUDE', count: 2 },
      { platform: 'GEMINI', count: 2 },
    ]);
    expect(res.body.top_categories[0]).toEqual({ category_code: 'CONTACT_INFO', count: 2 });
    expect(res.body.top_categories.map((c: { category_code: string }) => c.category_code)).not.toContain('VEHICLE');
    expect(res.body.departments).toBeUndefined();
    expect(res.body.lag_seconds).toBe(0);
  });

  it('a Department Admin cannot choose another department; a System Admin must name one', async () => {
    const own = await get(`/api/dashboard/department/summary?department_id=${deptB}`, tok.daA);
    expect(own.body.totals.total_events).toBe(6); // the parameter is ignored for them
    const missing = await get('/api/dashboard/department/summary', tok.saWeb);
    expect(missing.status).toBe(400);
    expect(missing.body.details.department_id).toContain('analytics.department_required');
    const b = await get(`/api/dashboard/department/summary?department_id=${deptB}`, tok.saWeb);
    expect(b.body.totals.total_events).toBe(2);
    expect((await get(`/api/dashboard/department/summary?department_id=${randomUUID()}`, tok.saWeb)).status).toBe(404);
  });

  it('org summary (System Admin only) includes the per-department risk distribution', async () => {
    const res = await get('/api/dashboard/org/summary', tok.saWeb);
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('ORG');
    expect(res.body.totals.total_events).toBeGreaterThanOrEqual(8);
    const a = res.body.departments.find((d: { department_id: string }) => d.department_id === deptA);
    const b = res.body.departments.find((d: { department_id: string }) => d.department_id === deptB);
    expect(a).toMatchObject({ department_name: expect.stringContaining('Dash A'), total: 6, high: 2, medium: 2, low: 1, none: 1, blocked: 2, warned: 2 });
    expect(b).toMatchObject({ total: 2, high: 1, none: 1 });
    expect((await get('/api/dashboard/org/summary', tok.daA)).status).toBe(403);
    expect((await get('/api/dashboard/org/summary', tok.userA)).status).toBe(403);
  });

  it('the personal dashboard reads the user own events only', async () => {
    const a1 = await get('/api/dashboard/mine/summary', tok.userA);
    expect(a1.status).toBe(200);
    expect(a1.body.scope).toBe('OWN');
    expect(a1.body.total_users).toBe(1);
    expect(a1.body.totals).toMatchObject({ total_events: 3, blocked: 2, warned: 1, high_risk: 2 });
    expect(a1.body.top_categories[0]).toEqual({ category_code: 'CONTACT_INFO', count: 2 });
    const b1 = await get('/api/dashboard/mine/summary', tok.userB);
    expect(b1.body.totals.total_events).toBe(2);
    const admin = await get('/api/dashboard/mine/summary', tok.saWeb);
    expect(admin.body.totals.total_events).toBe(0);
  });

  it('timeseries is zero-filled, ascending, and its totals match the summary', async () => {
    const res = await get('/api/dashboard/department/timeseries', tok.daA);
    expect(res.status).toBe(200);
    expect(DashboardTimeseriesResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.points).toHaveLength(30);
    const days = res.body.points.map((p: { day: string }) => p.day);
    expect([...days].sort()).toEqual(days);
    const sum = res.body.points.reduce((acc: number, p: { total: number }) => acc + p.total, 0);
    expect(sum).toBe(6);
    // All events were ingested "now", so exactly one day holds them (robust at UTC midnight).
    const busy = res.body.points.filter((p: { total: number }) => p.total > 0);
    expect(busy).toHaveLength(1);
    expect(busy[0]).toMatchObject({ total: 6, high: 2, medium: 2, low: 1, none: 1, blocked: 2, warned: 2 });
    expect(res.body.points[0].total).toBe(0);
  });

  it('top risky users: own department only, users with HIGH events first, nobody without one', async () => {
    const res = await get('/api/dashboard/department/top-users', tok.daA);
    expect(res.status).toBe(200);
    expect(TopRiskyUsersResponseSchema.safeParse(res.body).success).toBe(true);
    // a1 has 2 HIGH events (3 in all); a2 has none, and department B's user never appears.
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toMatchObject({ user_name: 'Synthetic d-a1', total: 3, high: 2, blocked: 2, warned: 1 });
    expect(Object.keys(res.body.users[0]).sort()).toEqual(['blocked', 'high', 'total', 'user_id', 'user_name', 'warned']);
  });

  it('top risky users: ordered by HIGH events, then blocked, then total; the range is clamped to 90 days', async () => {
    const deptC = await fx.department('Dash C');
    const mk = async (tag: string) => {
      const u = await fx.user(tag, { role: 'USER', departmentId: deptC });
      return t.app.get(TokenService).signAccess({ sub: u.id, tv: 0 }, 'extension');
    };
    const [c1, c2, c3] = [await mk('d-c1'), await mk('d-c2'), await mk('d-c3')];
    await send(c1, { risk_level: 'HIGH', action: 'BLOCKED' });
    await send(c2, { risk_level: 'HIGH', action: 'BLOCKED' });
    await send(c2, { risk_level: 'HIGH', action: 'WARNED' });
    await send(c3, { risk_level: 'HIGH', action: 'BLOCKED' });
    await send(c3, { risk_level: 'HIGH', action: 'BLOCKED' });
    await send(c3, { risk_level: 'NONE', action: 'ALLOWED', categories: [] });
    const res = await get(`/api/dashboard/department/top-users?department_id=${deptC}&from=2020-01-01`, tok.saWeb);
    expect(res.status).toBe(200);
    // c3: 2 HIGH, 2 blocked; c2: 2 HIGH, 1 blocked; c1: 1 HIGH.
    expect(res.body.users.map((u: { user_name: string }) => u.user_name)).toEqual(['Synthetic d-c3', 'Synthetic d-c2', 'Synthetic d-c1']);
    expect(res.body.users[0]).toMatchObject({ high: 2, blocked: 2, total: 3 });
    const days = (Date.parse(res.body.to) - Date.parse(res.body.from)) / 86_400_000;
    expect(days).toBe(89);
  });

  it('top risky users: a user is refused, a System Admin must name the department', async () => {
    expect((await get('/api/dashboard/department/top-users', tok.userA)).status).toBe(403);
    expect((await get('/api/dashboard/department/top-users', tok.saWeb)).status).toBe(400);
    const res = await get(`/api/dashboard/department/top-users?department_id=${deptB}`, tok.saWeb);
    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { user_name: string }) => u.user_name)).toEqual(['Synthetic d-b1']);
  });

  it('the personal dashboard is clamped to the last 90 days; a range entirely before that is refused', async () => {
    const res = await get('/api/dashboard/mine/summary?from=2020-01-01', tok.userA);
    expect(res.status).toBe(200);
    const days = (Date.parse(res.body.to) - Date.parse(res.body.from)) / 86_400_000;
    expect(days).toBe(89);
    expect((await get('/api/dashboard/mine/summary?from=2020-01-01&to=2020-02-01', tok.userA)).status).toBe(400);
    // The department dashboard (counters) may look further back, up to 366 days.
    const tooLong = await get('/api/dashboard/department/summary?from=2025-01-01', tok.daA);
    expect(tooLong.status).toBe(400);
    const from200 = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 10);
    expect((await get(`/api/dashboard/department/summary?from=${from200}`, tok.daA)).status).toBe(200);
  });

  it('a range filter excludes other days; old events land on their own day', async () => {
    const old = new Date(Date.now() - 10 * 86_400_000);
    await send(tok.extA1, { event_time: old.toISOString(), risk_level: 'LOW', action: 'ALLOWED', categories: [] });
    const day = old.toISOString().slice(0, 10);
    const only = await get(`/api/dashboard/department/summary?from=${day}&to=${day}`, tok.daA);
    expect(only.body.totals.total_events).toBe(1);
    const ts = await get(`/api/dashboard/department/timeseries?from=${day}&to=${day}`, tok.daA);
    expect(ts.body.points).toEqual([expect.objectContaining({ day, total: 1, low: 1 })]);
  });

  it('validates the range and rejects unknown parameters', async () => {
    for (const q of [
      'from=2026-13-40',
      'from=2026-02-30',
      'to=2026-02-31',
      'from=0000-01-01',
      'from=1969-12-31',
      'from=yesterday',
      'from=2026-03-02&to=2026-03-01',
      'from=2024-01-01&to=2026-01-01',
      'from=1971-01-01',
      'x=1',
    ]) {
      expect((await get(`/api/dashboard/org/summary?${q}`, tok.saWeb)).status, q).toBe(400);
    }
  });

  it('dashboards never write: counters are unchanged after reading', async () => {
    // Scoped to the departments of this suite: other suites ingest into the same database in parallel.
    const snapshot = async () =>
      (await fx.owner.query(`SELECT sum(event_count)::int AS n, count(*)::int AS rows FROM "EventCounter" WHERE department_id = ANY($1::uuid[])`, [[deptA, deptB]])).rows[0];
    const before = await snapshot();
    await get('/api/dashboard/org/summary', tok.saWeb);
    await get('/api/dashboard/org/timeseries', tok.saWeb);
    await get('/api/dashboard/department/summary', tok.daA);
    expect(await snapshot()).toEqual(before);
  });
});
