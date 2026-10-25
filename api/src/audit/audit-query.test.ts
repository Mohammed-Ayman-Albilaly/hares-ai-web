import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AuditQueryResponseSchema } from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';

// Audit trail read endpoint (B8). The trail itself is append-only; this checks
// the read side. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[audit-query] database not configured — skipping.');

describe.skipIf(!dbEnabled)('GET /admin/audit (B8)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let sa: { id: string };
  let saToken: string;
  let daToken: string;
  let userToken: string;
  let dept: string;

  const get = (path: string, bearer: string) => t.call('GET', path, { bearer });

  beforeAll(async () => {
    fx = new Fixtures();
    dept = await fx.department('Audit Q');
    sa = await fx.user('aq-sa', { role: 'SYSTEM_ADMIN' });
    const da = await fx.user('aq-da', { role: 'DEPARTMENT_ADMIN', departmentId: dept });
    const user = await fx.user('aq-user', { role: 'USER', departmentId: dept });
    t = await bootTestApp();
    const s = t.app.get(TokenService);
    saToken = await s.signAccess({ sub: sa.id, tv: 0 }, 'web');
    daToken = await s.signAccess({ sub: da.id, tv: 0 }, 'web');
    userToken = await s.signAccess({ sub: user.id, tv: 0 }, 'web');
    // Real admin actions create real entries (department create + rename + a user approval).
    const created = await t.call('POST', '/api/admin/departments', { bearer: saToken, body: { name: `AQ ${fx.salt}` } });
    await t.call('PATCH', `/api/admin/departments/${created.body.id}`, { bearer: saToken, body: { name: `AQ2 ${fx.salt}` } });
    const pending = await fx.user('aq-pending', { status: 'PENDING' });
    await t.call('POST', `/api/admin/users/${pending.id}/approve`, { bearer: saToken, body: { department_id: dept, role: 'USER' } });
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  it('System Admin only: Department Admin and User get 403', async () => {
    expect((await get('/api/admin/audit', daToken)).status).toBe(403);
    expect((await get('/api/admin/audit', userToken)).status).toBe(403);
    expect((await t.call('GET', '/api/admin/audit')).status).toBe(401);
  });

  it('lists entries newest first with admin name, action, target label and detail', async () => {
    const res = await get('/api/admin/audit?page_size=100', saToken);
    expect(res.status).toBe(200);
    expect(AuditQueryResponseSchema.safeParse(res.body).success).toBe(true);
    const items = res.body.items;
    const times = items.map((i: { created_at: string }) => i.created_at);
    expect([...times].sort().reverse()).toEqual(times);
    const approved = items.find((i: { action_type: string; target_name: string | null }) => i.action_type === 'USER_APPROVED' && i.target_name === 'Synthetic aq-pending');
    expect(approved).toMatchObject({ acting_admin_id: sa.id, acting_admin_name: 'Synthetic aq-sa', target_type: 'USER', target_name: 'Synthetic aq-pending' });
    expect(approved.detail).toEqual({ role: 'USER', department_id: dept });
    const renamed = items.find((i: { action_type: string; target_name: string | null }) => i.action_type === 'DEPARTMENT_RENAMED' && i.target_name === `AQ2 ${fx.salt}`);
    expect(renamed.target_name).toBe(`AQ2 ${fx.salt}`);
    expect(renamed.detail).toMatchObject({ new_name: `AQ2 ${fx.salt}` });
  });

  it('filters by action, target type, admin and time', async () => {
    const byAction = await get('/api/admin/audit?action_type=DEPARTMENT_CREATED', saToken);
    expect(byAction.body.items.every((i: { action_type: string }) => i.action_type === 'DEPARTMENT_CREATED')).toBe(true);
    expect(byAction.body.items.length).toBeGreaterThan(0);
    const byTarget = await get('/api/admin/audit?target_type=USER', saToken);
    expect(byTarget.body.items.every((i: { target_type: string }) => i.target_type === 'USER')).toBe(true);
    const byAdmin = await get(`/api/admin/audit?acting_admin_id=${randomUUID()}`, saToken);
    expect(byAdmin.body.items).toEqual([]);
    const future = await get(`/api/admin/audit?from=${new Date(Date.now() + 3_600_000).toISOString()}`, saToken);
    expect(future.body.items).toEqual([]);
  });

  it('pages with a keyset cursor that keeps microsecond precision (no gaps, no repeats)', async () => {
    // Several entries inside the same millisecond, written directly with microsecond timestamps.
    const stamps = ['.500900', '.500800', '.500700', '.500123', '.500100'];
    for (const frac of stamps) {
      await fx.owner.query(
        `INSERT INTO "AdminAuditLog" (id, acting_admin_id, action_type, target_type, target_id, created_at)
         VALUES (gen_random_uuid(), $1, 'SYSTEM_ADMIN_GRANTED', 'USER', $1, $2::timestamptz)`,
        [sa.id, `2030-01-01T00:00:00${frac}Z`],
      );
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await get(`/api/admin/audit?from=2030-01-01T00:00:00Z&page_size=2${cursor ? `&cursor=${cursor}` : ''}`, saToken);
      expect(res.status).toBe(200);
      seen.push(...res.body.items.map((i: { created_at: string }) => i.created_at));
      cursor = res.body.next_cursor;
    } while (cursor);
    expect(seen).toEqual(stamps.map((f) => `2030-01-01T00:00:00${f}Z`));
  });

  it('rejects bad parameters and tampered cursors with 400', async () => {
    for (const q of ['action_type=NOPE', 'x=1', 'page_size=101', `from=2030-01-02T00:00:00Z&to=2030-01-01T00:00:00Z`]) {
      expect((await get(`/api/admin/audit?${q}`, saToken)).status, q).toBe(400);
    }
    const bad = await get('/api/admin/audit?cursor=garbage', saToken);
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_CURSOR');
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    for (const cursor of [
      enc(['2026-13-45T99:99:99.000000Z', randomUUID()]),
      enc(['2026-03-01T10:00:00.123456Z', '------------------------------------']),
      enc(['2026-03-01T10:00:00.123456Z']),
    ]) {
      const res = await get(`/api/admin/audit?cursor=${cursor}`, saToken);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CURSOR');
    }
  });

  it('the endpoint is read-only: other methods do not exist', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await t.call(method, '/api/admin/audit', { bearer: saToken, body: {} });
      expect([404, 405], method).toContain(res.status);
    }
  });
});
