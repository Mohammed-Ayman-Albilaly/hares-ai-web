import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CSV_COLUMNS, LogDetailSchema, LogListResponseSchema } from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';

// Log review, filters and CSV export (B7b). Runs in the per-run test database.
// SYNTHETIC DATA ONLY: no prompt text exists in the schema or in these rows.

if (!dbEnabled) console.warn('[logs] database not configured — skipping.');

describe.skipIf(!dbEnabled)('log review and export (B7b)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let deptA: string;
  let deptB: string;
  let alice: { id: string; email: string };
  let bob: { id: string };
  let carol: { id: string }; // deptB
  let sa: { id: string };
  let daA: { id: string };
  let tok: Record<'alice' | 'bob' | 'carol' | 'sa' | 'daA', string>;
  const ids: Record<string, string> = {};

  const get = (path: string, bearer: string) => t.call('GET', path, { bearer });
  const hours = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

  async function insertLog(
    key: string,
    userId: string,
    departmentId: string | null,
    over: {
      platform?: string;
      risk_level?: string;
      action?: string;
      user_decision?: string;
      categories?: string[];
      hoursAgo?: number;
      ruleId?: string;
    } = {},
  ) {
    const id = randomUUID();
    ids[key] = id;
    await fx.owner.query(
      `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source,
                                  user_decision, schema_version, event_time, received_at, rule_id)
       VALUES ($1, $2, $3, $4::platform, $5::risk_level, $6::log_action, 'LOCAL', $7::user_decision, 1, $8, now(), $9)`,
      [
        id,
        userId,
        departmentId,
        over.platform ?? 'CHATGPT',
        over.risk_level ?? 'HIGH',
        over.action ?? 'BLOCKED',
        over.user_decision ?? 'NONE',
        hours(over.hoursAgo ?? 1),
        over.ruleId ?? null,
      ],
    );
    for (const c of over.categories ?? ['CONTACT_INFO']) {
      await fx.owner.query('INSERT INTO "LogCategory" (log_id, category_code) VALUES ($1, $2)', [id, c]);
    }
    return id;
  }

  beforeAll(async () => {
    fx = new Fixtures();
    deptA = await fx.department('Logs A');
    deptB = await fx.department('Logs B');
    alice = await fx.user('l-alice', { role: 'USER', departmentId: deptA });
    bob = await fx.user('l-bob', { role: 'USER', departmentId: deptA });
    carol = await fx.user('l-carol', { role: 'USER', departmentId: deptB });
    sa = await fx.user('l-sa', { role: 'SYSTEM_ADMIN' });
    daA = await fx.user('l-da', { role: 'DEPARTMENT_ADMIN', departmentId: deptA });
    // Dedicated formula-injection user (name starts with '=').
    await fx.owner.query(`UPDATE "User" SET full_name = $1 WHERE id = $2`, ['=HYPERLINK("http://x")', bob.id]);

    await insertLog('a1', alice.id, deptA, { hoursAgo: 5, risk_level: 'HIGH', action: 'BLOCKED', categories: ['CONTACT_INFO', 'FINANCIAL_BANKING'] });
    await insertLog('a2', alice.id, deptA, { hoursAgo: 4, risk_level: 'MEDIUM', action: 'WARNED', platform: 'GEMINI', user_decision: 'SUBMITTED_ANYWAY', categories: ['LOCATION'] });
    await insertLog('a3', alice.id, deptA, { hoursAgo: 3, risk_level: 'NONE', action: 'ALLOWED', platform: 'CLAUDE', categories: [] });
    await insertLog('b1', bob.id, deptA, { hoursAgo: 2, risk_level: 'HIGH', action: 'BLOCKED', categories: ['CONTACT_INFO'] });
    await insertLog('c1', carol.id, deptB, { hoursAgo: 2, risk_level: 'HIGH', action: 'BLOCKED', categories: ['CONTACT_INFO'] });
    await insertLog('s1', sa.id, null, { hoursAgo: 1, risk_level: 'LOW', action: 'ALLOWED', categories: ['DATES_TIME'] });

    t = await bootTestApp();
    const signer = t.app.get(TokenService);
    const sign = (id: string) => signer.signAccess({ sub: id, tv: 0 }, 'web');
    tok = { alice: await sign(alice.id), bob: await sign(bob.id), carol: await sign(carol.id), sa: await sign(sa.id), daA: await sign(daA.id) };
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  const idsOf = (res: { body: { items: { log_id: string }[] } }) => res.body.items.map((i) => i.log_id);

  // ---------- own logs ----------

  it('a user sees only their own events, newest first, with the table columns', async () => {
    const res = await get('/api/logs/mine', tok.alice);
    expect(res.status).toBe(200);
    expect(LogListResponseSchema.safeParse(res.body).success).toBe(true);
    expect(idsOf(res)).toEqual([ids.a3, ids.a2, ids.a1]);
    expect(res.body.items[2]).toMatchObject({ platform: 'CHATGPT', risk_level: 'HIGH', action: 'BLOCKED', categories: ['CONTACT_INFO', 'FINANCIAL_BANKING'] });
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ['action', 'categories', 'department_id', 'department_name', 'event_time', 'log_id', 'platform', 'risk_level', 'rule_name', 'user_decision', 'user_id', 'user_name'].sort(),
    );
    expect(res.body.next_cursor).toBeNull();
  });

  it('"Blocked Messages" is the own log filtered to BLOCKED; a user cannot see another user via filters', async () => {
    const blocked = await get('/api/logs/mine?action=BLOCKED', tok.alice);
    expect(idsOf(blocked)).toEqual([ids.a1]);
    // user_id / department_id are not accepted on the own endpoint at all.
    expect((await get(`/api/logs/mine?user_id=${bob.id}`, tok.alice)).status).toBe(400);
    expect((await get(`/api/logs/mine?department_id=${deptB}`, tok.alice)).status).toBe(400);
    expect(idsOf(await get('/api/logs/mine', tok.carol))).toEqual([ids.c1]);
  });

  // ---------- admin scope ----------

  it('a user cannot use the admin endpoints (403), anonymous gets 401', async () => {
    for (const path of ['/api/admin/logs', `/api/admin/logs/${ids.a1}`, '/api/admin/logs/export']) {
      expect((await get(path, tok.alice)).status, path).toBe(403);
    }
    expect((await t.call('GET', '/api/admin/logs')).status).toBe(401);
  });

  it('a Department Admin sees only their department; the department filter cannot widen it', async () => {
    const res = await get('/api/admin/logs?page_size=100', tok.daA);
    expect(res.status).toBe(200);
    expect(idsOf(res).sort()).toEqual([ids.a1, ids.a2, ids.a3, ids.b1].sort());
    const widened = await get(`/api/admin/logs?department_id=${deptB}`, tok.daA);
    expect(idsOf(widened).sort()).toEqual([ids.a1, ids.a2, ids.a3, ids.b1].sort());
  });

  it('a System Admin sees the whole organisation, including events with no department', async () => {
    const res = await get('/api/admin/logs?page_size=100', tok.sa);
    const all = idsOf(res);
    for (const k of ['a1', 'a2', 'a3', 'b1', 'c1', 's1']) expect(all).toContain(ids[k]);
    const onlyB = await get(`/api/admin/logs?department_id=${deptB}`, tok.sa);
    expect(idsOf(onlyB)).toEqual([ids.c1]);
  });

  // ---------- filters ----------

  it('filters by date range, user, risk, platform, category, user decision and action', async () => {
    const q = (qs: string) => get(`/api/admin/logs?${qs}`, tok.sa).then((r) => idsOf(r));
    expect(await q(`user_id=${alice.id}&risk_level=HIGH`)).toEqual([ids.a1]);
    expect(await q(`user_id=${alice.id}&platform=GEMINI`)).toEqual([ids.a2]);
    expect(await q(`user_id=${alice.id}&category=LOCATION`)).toEqual([ids.a2]);
    expect(await q(`user_id=${alice.id}&user_decision=SUBMITTED_ANYWAY`)).toEqual([ids.a2]);
    expect(await q(`user_id=${alice.id}&action=ALLOWED`)).toEqual([ids.a3]);
    expect((await q(`category=CONTACT_INFO&department_id=${deptA}`)).sort()).toEqual([ids.a1, ids.b1].sort());
    expect(await q(`user_id=${alice.id}&from=${hours(4.5)}&to=${hours(3.5)}`)).toEqual([ids.a2]);
    expect(await q(`user_id=${alice.id}&category=VEHICLE`)).toEqual([]);
  });

  it('rejects bad filters: unknown field, bad enum, reversed range, bad cursor', async () => {
    expect((await get('/api/admin/logs?prompt=x', tok.sa)).status).toBe(400);
    expect((await get('/api/admin/logs?risk_level=EXTREME', tok.sa)).status).toBe(400);
    expect((await get(`/api/admin/logs?from=${hours(1)}&to=${hours(2)}`, tok.sa)).status).toBe(400);
    expect((await get('/api/admin/logs?page_size=101', tok.sa)).status).toBe(400);
    const bad = await get('/api/admin/logs?cursor=garbage', tok.sa);
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_CURSOR');
  });

  // ---------- keyset pagination ----------

  it('pages with a keyset cursor: no gaps or repeats, even with identical timestamps', async () => {
    const same = new Date(Date.now() - 600_000).toISOString();
    const batch: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = randomUUID();
      batch.push(id);
      await fx.owner.query(
        `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
         VALUES ($1, $2, $3, 'CLAUDE', 'LOW', 'ALLOWED', 'LOCAL', 'NONE', 1, $4, now())`,
        [id, carol.id, deptB, same],
      );
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await get(`/api/admin/logs?department_id=${deptB}&platform=CLAUDE&page_size=2${cursor ? `&cursor=${cursor}` : ''}`, tok.sa);
      expect(res.status).toBe(200);
      seen.push(...idsOf(res));
      cursor = res.body.next_cursor;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort()).toEqual([...batch].sort());
  });

  it('keyset paging keeps microsecond precision (rows within the same millisecond are not skipped)', async () => {
    // Recent (inside the 90-day retention): the retention suite purges old rows in the same database.
    const base = `${new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10)}T10:00:00`;
    const stamps = ['.123900', '.123456', '.123100', '.123000'];
    const created: string[] = [];
    for (const frac of stamps) {
      const id = randomUUID();
      created.push(id);
      await fx.owner.query(
        `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
         VALUES ($1, $2, $3, 'CLAUDE', 'NONE', 'ALLOWED', 'LOCAL', 'NONE', 1, $4::timestamptz, now())`,
        [id, carol.id, deptB, `${base}${frac}Z`],
      );
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await get(
        `/api/admin/logs?department_id=${deptB}&platform=CLAUDE&risk_level=NONE&page_size=1${cursor ? `&cursor=${cursor}` : ''}`,
        tok.sa,
      );
      seen.push(...idsOf(res));
      cursor = res.body.next_cursor;
    } while (cursor);
    expect(seen).toEqual(created); // newest (.123900) to oldest (.123000)
  });

  it('a tampered cursor is a 400 INVALID_CURSOR, never a 500', async () => {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    for (const cursor of [
      enc(['Jan 1 2020 GMT+0100', randomUUID()]),
      enc(['2026-03-01T10:00:00.123456Z', '------------------------------------']),
      enc(['2026-03-01T10:00:00.123456Z']),
      enc({ a: 1 }),
      enc('x'),
      'not-base64-json',
    ]) {
      const res = await get(`/api/admin/logs?cursor=${cursor}`, tok.sa);
      expect(res.status, cursor).toBe(400);
      expect(res.body.code).toBe('INVALID_CURSOR');
    }
  });

  // ---------- detail / IDOR ----------

  it('detail is scoped like the list: a log outside the scope is 404 (no existence oracle)', async () => {
    const ok = await get(`/api/admin/logs/${ids.a1}`, tok.daA);
    expect(ok.status).toBe(200);
    expect(LogDetailSchema.safeParse(ok.body).success).toBe(true);
    expect(ok.body.user_email).toBe(alice.email);
    const other = await get(`/api/admin/logs/${ids.c1}`, tok.daA);
    expect(other.status).toBe(404);
    expect(other.body.code).toBe('LOG_NOT_FOUND');
    const missing = await get(`/api/admin/logs/${randomUUID()}`, tok.daA);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: other.body.code, message: other.body.message });
    expect((await get(`/api/admin/logs/${ids.c1}`, tok.sa)).status).toBe(200);
    expect((await get('/api/admin/logs/not-a-uuid', tok.sa)).status).toBe(400);
  });

  it('an event caught only by a rule carries the rule name in the list and the detail, and others carry null', async () => {
    const ruleId = randomUUID();
    await fx.owner.query(
      `INSERT INTO "CustomRule" (id, created_by, kind, name, definition, risk_level, action, scope, enabled)
       VALUES ($1, $2, 'KEYWORD', 'Project Atlas', 'atlas', 'HIGH', 'BLOCK', 'ORG_WIDE', true)`,
      [ruleId, sa.id],
    );
    const id = await insertLog('rule-only', alice.id, deptA, { categories: [], ruleId });

    const list = await get('/api/admin/logs', tok.daA);
    expect(LogListResponseSchema.safeParse(list.body).success).toBe(true);
    const row = list.body.items.find((x: { log_id: string }) => x.log_id === id);
    expect(row).toMatchObject({ categories: [], rule_name: 'Project Atlas' });
    expect(list.body.items.find((x: { log_id: string }) => x.log_id === ids.a1).rule_name).toBeNull();
    expect((await get(`/api/admin/logs/${id}`, tok.daA)).body.rule_name).toBe('Project Atlas');
    // The user sees why their own message was caught.
    const own = await get('/api/logs/mine', tok.alice);
    expect(own.body.items.find((x: { log_id: string }) => x.log_id === id).rule_name).toBe('Project Atlas');
  });

  // ---------- CSV export ----------

  it('exports CSV with the allowed columns, BOM, attachment headers and only the filtered, scoped rows', async () => {
    const res = await get(`/api/admin/logs/export?department_id=${deptA}&risk_level=HIGH`, tok.sa);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="activity-logs-\d{8}\.csv"$/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const lines = res.text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    const body = lines.slice(1).join('\n');
    expect(body).toContain(ids.a1);
    expect(body).toContain(ids.b1);
    expect(body).not.toContain(ids.a2); // MEDIUM
    expect(body).not.toContain(ids.c1); // other department
    expect(lines.every((l) => l.split(',').length >= CSV_COLUMNS.length - 2)).toBe(true);
  });

  it('prefixes formula cells (= + - @) so a spreadsheet shows them as text', async () => {
    const res = await get(`/api/admin/logs/export?user_id=${bob.id}`, tok.sa);
    // bob's name starts with "=": prefixed with a quote (and quoted because it holds a comma/quote).
    expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('quotes cells with commas, quotes and line breaks end to end, and exports only the header for no rows', async () => {
    const odd = await fx.user('l-odd', { role: 'USER', departmentId: deptA });
    await fx.owner.query(`UPDATE "User" SET full_name = $1 WHERE id = $2`, ['Ann, "Bee"\nLine2', odd.id]);
    await insertLog('odd', odd.id, deptA, { hoursAgo: 1, categories: [] });
    const res = await get(`/api/admin/logs/export?user_id=${odd.id}`, tok.sa);
    expect(res.text).toContain('"Ann, ""Bee""\nLine2"');
    const none = await get(`/api/admin/logs/export?user_id=${odd.id}&risk_level=LOW`, tok.sa);
    expect(none.status).toBe(200);
    expect(none.text.slice(1).trim()).toBe(CSV_COLUMNS.join(','));
  });

  it('a Department Admin exports only their department; a User gets 403', async () => {
    const res = await get('/api/admin/logs/export', tok.daA);
    expect(res.status).toBe(200);
    expect(res.text).toContain(ids.a1);
    expect(res.text).not.toContain(ids.c1);
    expect(res.text).not.toContain(ids.s1);
    expect((await get('/api/admin/logs/export', tok.alice)).status).toBe(403);
    expect((await get('/api/admin/logs/export?prompt=x', tok.sa)).status).toBe(400);
  });

  it('streams large exports in chunks without gaps (more rows than one chunk)', async () => {
    await fx.owner.query(
      `INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action, classification_source, user_decision, schema_version, event_time, received_at)
       SELECT gen_random_uuid(), $1, $2, 'GEMINI', 'NONE', 'ALLOWED', 'LOCAL', 'NONE', 1, now() - (g || ' seconds')::interval - interval '2 hours', now()
         FROM generate_series(1, 2300) g`,
      [carol.id, deptB],
    );
    const res = await get(`/api/admin/logs/export?department_id=${deptB}&platform=GEMINI`, tok.sa);
    const rows = res.text.slice(1).trim().split('\r\n');
    expect(rows).toHaveLength(2301); // header + 2300
    const first = rows[1].split(',')[0];
    expect(new Set(rows.slice(1).map((r) => r.split(',')[0])).size).toBe(2300);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });
});
