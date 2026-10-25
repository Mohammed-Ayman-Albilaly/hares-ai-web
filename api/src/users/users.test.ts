import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdminUserResponseSchema, ProfileResponseSchema, UserListResponseSchema } from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';

// Admin user lifecycle (B5b): approve flow, scope, self-protection, hierarchy,
// token revocation and audit. Runs in the per-run test database.
// SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[users] database not configured — skipping.');

describe.skipIf(!dbEnabled)('users lifecycle (B5b)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let sa: { id: string; email: string };
  let da: { id: string };
  let deptA: string;
  let deptB: string;
  let inactiveDept: string;
  let saToken: string;
  let daToken: string;
  let userToken: string;
  let plain: { id: string };

  const sign = (sub: string, tv = 0) => t.app.get(TokenService).signAccess({ sub, tv }, 'web');
  const post = (path: string, bearer: string, body: unknown = {}) => t.call('POST', `/api/admin/users/${path}`, { bearer, body });
  const patch = (path: string, bearer: string, body: unknown) => t.call('PATCH', `/api/admin/users/${path}`, { bearer, body });
  const audit = async (target: string) =>
    (await fx.owner.query('SELECT action_type, acting_admin_id, detail FROM "AdminAuditLog" WHERE target_id = $1 ORDER BY created_at', [target])).rows;
  const row = async (id: string) =>
    (await fx.owner.query('SELECT status, role, department_id, token_version, approved_by FROM "User" WHERE id = $1', [id])).rows[0];
  const pendingUser = (tag: string) => fx.user(tag, { status: 'PENDING' });

  beforeAll(async () => {
    fx = new Fixtures();
    deptA = await fx.department('Users A');
    deptB = await fx.department('Users B');
    inactiveDept = await fx.department('Users Off', false);
    sa = await fx.user('u-sa', { role: 'SYSTEM_ADMIN' });
    da = await fx.user('u-da', { role: 'DEPARTMENT_ADMIN', departmentId: deptA });
    plain = await fx.user('u-plain', { role: 'USER', departmentId: deptA });
    t = await bootTestApp();
    saToken = await sign(sa.id);
    daToken = await sign(da.id);
    userToken = await sign(plain.id);
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    // Audit rows are append-only; they live and die with the throwaway database.
    await fx?.owner.end();
  });

  // ---------- profile ----------

  it('shows the own profile with the department name (any role)', async () => {
    const res = await t.call('GET', '/api/profile', { bearer: userToken });
    expect(res.status).toBe(200);
    expect(ProfileResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.department).toMatchObject({ id: deptA });
    const noDept = await t.call('GET', '/api/profile', { bearer: saToken });
    expect(noDept.body.department).toBeNull();
  });

  // ---------- pending + approve ----------

  it('lists pending users (SA only), oldest first, and Department Admin gets 403 with no state change', async () => {
    const p = await pendingUser('u-pend-list');
    const res = await t.call('GET', '/api/admin/users/pending', { bearer: saToken });
    expect(res.status).toBe(200);
    expect(UserListResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.some((u: { id: string }) => u.id === p.id)).toBe(true);
    expect(res.body.items.every((u: { status: string }) => u.status === 'PENDING')).toBe(true);

    expect((await t.call('GET', '/api/admin/users/pending', { bearer: daToken })).status).toBe(403);
    const before = await row(p.id);
    expect((await post(`${p.id}/approve`, daToken, { department_id: deptA, role: 'USER' })).status).toBe(403);
    expect(await row(p.id)).toEqual(before);
  });

  it('approves in ONE update: status, role, department, approver together; audited; can log in', async () => {
    const p = await pendingUser('u-approve');
    const res = await post(`${p.id}/approve`, saToken, { department_id: deptA, role: 'DEPARTMENT_ADMIN' });
    expect(res.status).toBe(200);
    expect(AdminUserResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({ status: 'ACTIVE', role: 'DEPARTMENT_ADMIN', department_id: deptA });
    expect(await row(p.id)).toMatchObject({ status: 'ACTIVE', role: 'DEPARTMENT_ADMIN', department_id: deptA, approved_by: sa.id });
    expect(await audit(p.id)).toEqual([
      { action_type: 'USER_APPROVED', acting_admin_id: sa.id, detail: { role: 'DEPARTMENT_ADMIN', department_id: deptA } },
    ]);
    const login = await t.call('POST', '/api/auth/login', { body: { email: p.email, password: 'Synthetic#Pass1' } });
    expect(login.status).toBe(200);
  });

  it('cannot approve into SYSTEM_ADMIN, an inactive or unknown department, or a non-pending user', async () => {
    const p = await pendingUser('u-approve-bad');
    expect((await post(`${p.id}/approve`, saToken, { department_id: deptA, role: 'SYSTEM_ADMIN' })).status).toBe(400);
    const inactive = await post(`${p.id}/approve`, saToken, { department_id: inactiveDept, role: 'USER' });
    expect(inactive.status).toBe(409);
    expect(inactive.body.code).toBe('DEPARTMENT_INACTIVE');
    const unknown = await post(`${p.id}/approve`, saToken, { department_id: '00000000-0000-4000-8000-000000000009', role: 'USER' });
    expect(unknown.body.code).toBe('DEPARTMENT_NOT_FOUND');
    expect((await row(p.id)).status).toBe('PENDING');

    const active = await post(`${plain.id}/approve`, saToken, { department_id: deptA, role: 'USER' });
    expect(active.status).toBe(409);
    expect(active.body.code).toBe('INVALID_USER_STATE');
  });

  it('two concurrent approvals: one wins, the other gets 409, one audit entry', async () => {
    const p = await pendingUser('u-approve-race');
    const results = await Promise.all([
      post(`${p.id}/approve`, saToken, { department_id: deptA, role: 'USER' }),
      post(`${p.id}/approve`, saToken, { department_id: deptB, role: 'USER' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await audit(p.id)).toHaveLength(1);
  });

  // ---------- reject / reopen ----------

  it('rejects (terminal, cannot log in), then a System Admin may re-open it to PENDING', async () => {
    const p = await pendingUser('u-reject');
    const res = await post(`${p.id}/reject`, saToken);
    expect(res.body.status).toBe('REJECTED');
    const login = await t.call('POST', '/api/auth/login', { body: { email: p.email, password: 'Synthetic#Pass1' } });
    expect(login.body.code).toBe('ACCOUNT_REJECTED');

    expect((await post(`${p.id}/approve`, saToken, { department_id: deptA, role: 'USER' })).status).toBe(409);
    const reopened = await post(`${p.id}/reopen`, saToken);
    expect(reopened.body.status).toBe('PENDING');
    expect((await audit(p.id)).map((a) => a.action_type)).toEqual(['USER_REJECTED', 'USER_REOPENED']);
    expect((await post(`${plain.id}/reopen`, saToken)).status).toBe(409);
  });

  // ---------- deactivate / reactivate ----------

  it('deactivation bumps token_version and kills outstanding access and refresh tokens at once', async () => {
    const u = await fx.user('u-deact', { role: 'USER', departmentId: deptA });
    const session = await t.call('POST', '/api/auth/login', { body: { email: u.email, password: 'Synthetic#Pass1' } });
    const cookie = session.cookies[0].split(';')[0];
    const ext = await t.call('POST', '/api/extension/login', { body: { email: u.email, password: 'Synthetic#Pass1' } });

    const res = await post(`${u.id}/deactivate`, saToken);
    expect(res.body.status).toBe('DEACTIVATED');
    expect((await row(u.id)).token_version).toBe(1);

    expect((await t.call('GET', '/api/profile', { bearer: session.body.access_token })).body.code).toBe('TOKEN_REVOKED');
    expect((await t.call('POST', '/api/auth/refresh', { headers: { cookie } })).status).toBe(401);
    expect((await t.call('POST', '/api/extension/refresh', { body: { refresh_token: ext.body.refresh_token } })).status).toBe(401);
    expect((await t.call('POST', '/api/auth/login', { body: { email: u.email, password: 'Synthetic#Pass1' } })).body.code).toBe('ACCOUNT_INACTIVE');
    expect((await audit(u.id))[0].action_type).toBe('USER_DEACTIVATED');
  });

  it('reactivation (System Admin only) keeps the role; needs an active department', async () => {
    const u = await fx.user('u-react', { role: 'USER', departmentId: deptA });
    await post(`${u.id}/deactivate`, saToken);
    expect((await post(`${u.id}/reactivate`, daToken)).status).toBe(403);

    // Their department gets deactivated meanwhile: reactivation needs a new one.
    const gone = await fx.department('Users Gone');
    await fx.owner.query('UPDATE "User" SET department_id = $1 WHERE id = $2', [gone, u.id]);
    await fx.owner.query('UPDATE "Department" SET active = false WHERE id = $1', [gone]);
    const blocked = await post(`${u.id}/reactivate`, saToken);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('DEPARTMENT_INACTIVE');

    const ok = await post(`${u.id}/reactivate`, saToken, { department_id: deptB });
    expect(ok.body).toMatchObject({ status: 'ACTIVE', role: 'USER', department_id: deptB });
    expect((await t.call('POST', '/api/auth/login', { body: { email: u.email, password: 'Synthetic#Pass1' } })).status).toBe(200);
    expect((await post(`${u.id}/reactivate`, saToken)).status).toBe(409);
  });

  // ---------- department admin scope ----------

  it('Department Admin deactivates a USER of their own department only', async () => {
    const mine = await fx.user('u-da-mine', { role: 'USER', departmentId: deptA });
    const other = await fx.user('u-da-other', { role: 'USER', departmentId: deptB });
    const peer = await fx.user('u-da-peer', { role: 'DEPARTMENT_ADMIN', departmentId: deptA });
    const admin = await fx.user('u-da-sa', { role: 'SYSTEM_ADMIN' });

    expect((await post(`${other.id}/deactivate`, daToken)).status).toBe(403);
    expect((await post(`${peer.id}/deactivate`, daToken)).status).toBe(403);
    expect((await post(`${admin.id}/deactivate`, daToken)).status).toBe(403);
    expect((await post(`${da.id}/deactivate`, daToken)).body.code).toBe('CANNOT_MODIFY_SELF');
    for (const id of [other.id, peer.id, admin.id]) expect((await row(id)).status).toBe('ACTIVE');

    const ok = await post(`${mine.id}/deactivate`, daToken);
    expect(ok.status).toBe(200);
    expect((await audit(mine.id))[0]).toMatchObject({ action_type: 'USER_DEACTIVATED', acting_admin_id: da.id });
  });

  it('Department Admin lists only their own department, even when asking for another', async () => {
    const res = await t.call('GET', `/api/admin/users?department_id=${deptB}&page_size=100`, { bearer: daToken });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((u: { department_id: string }) => u.department_id === deptA)).toBe(true);
    expect((await t.call('GET', '/api/admin/users', { bearer: userToken })).status).toBe(403);
  });

  it('System Admin lists with filters and pagination', async () => {
    const res = await t.call('GET', `/api/admin/users?department_id=${deptA}&role=USER&page=1&page_size=1`, { bearer: saToken });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBeGreaterThan(1);
    expect(res.body.items[0]).toMatchObject({ role: 'USER', department_id: deptA });
    const bySearch = await t.call('GET', `/api/admin/users?q=${encodeURIComponent(sa.email.split('@')[0])}`, { bearer: saToken });
    expect(bySearch.body.items.map((u: { id: string }) => u.id)).toContain(sa.id);
    expect((await t.call('GET', '/api/admin/users?page_size=1000', { bearer: saToken })).status).toBe(400);
  });

  // ---------- role / department ----------

  it('assigns role and department (audited with old and new values)', async () => {
    const u = await fx.user('u-assign', { role: 'USER', departmentId: deptA });
    const role = await patch(`${u.id}/role`, saToken, { role: 'DEPARTMENT_ADMIN' });
    expect(role.body.role).toBe('DEPARTMENT_ADMIN');
    expect((await patch(`${u.id}/role`, saToken, { role: 'SYSTEM_ADMIN' })).status).toBe(400);
    const moved = await patch(`${u.id}/department`, saToken, { department_id: deptB });
    expect(moved.body.department_id).toBe(deptB);
    expect((await patch(`${u.id}/department`, saToken, { department_id: inactiveDept })).body.code).toBe('DEPARTMENT_INACTIVE');
    expect(await audit(u.id)).toEqual([
      { action_type: 'USER_ROLE_CHANGED', acting_admin_id: sa.id, detail: { old_role: 'USER', new_role: 'DEPARTMENT_ADMIN' } },
      {
        action_type: 'USER_DEPARTMENT_CHANGED',
        acting_admin_id: sa.id,
        detail: { old_department_id: deptA, new_department_id: deptB },
      },
    ]);
    // Same value again is a quiet no-op: no extra audit entry.
    await patch(`${u.id}/department`, saToken, { department_id: deptB });
    expect(await audit(u.id)).toHaveLength(2);
  });

  it('Department Admin cannot assign roles or departments', async () => {
    expect((await patch(`${plain.id}/role`, daToken, { role: 'DEPARTMENT_ADMIN' })).status).toBe(403);
    expect((await patch(`${plain.id}/department`, daToken, { department_id: deptB })).status).toBe(403);
    expect((await row(plain.id)).role).toBe('USER');
  });

  // ---------- system admin grant / revoke ----------

  it('grants SYSTEM_ADMIN (no department), then revoking needs a role and an active department', async () => {
    const u = await fx.user('u-grant', { role: 'USER', departmentId: deptA });
    const granted = await post(`${u.id}/grant-system-admin`, saToken);
    expect(granted.body).toMatchObject({ role: 'SYSTEM_ADMIN', department_id: null });
    expect((await post(`${u.id}/grant-system-admin`, saToken)).status).toBe(409);
    expect((await post(`${pendingUserId}/grant-system-admin`, saToken)).status).toBe(409);
    expect((await post(`${u.id}/grant-system-admin`, daToken)).status).toBe(403);

    const bad = await post(`${u.id}/revoke-system-admin`, saToken, { role: 'USER', department_id: inactiveDept });
    expect(bad.body.code).toBe('DEPARTMENT_INACTIVE');
    const revoked = await post(`${u.id}/revoke-system-admin`, saToken, { role: 'DEPARTMENT_ADMIN', department_id: deptB });
    expect(revoked.body).toMatchObject({ role: 'DEPARTMENT_ADMIN', department_id: deptB });
    expect((await audit(u.id)).map((a) => a.action_type)).toEqual(['SYSTEM_ADMIN_GRANTED', 'SYSTEM_ADMIN_REVOKED']);
  });

  let pendingUserId = '';
  beforeAll(async () => {
    pendingUserId = (await pendingUser('u-grant-pending')).id;
  });

  // ---------- self-protection ----------

  it('nobody can deactivate, demote or revoke themselves (403 CANNOT_MODIFY_SELF, no state change)', async () => {
    const before = await row(sa.id);
    for (const res of [
      await post(`${sa.id}/deactivate`, saToken),
      await post(`${sa.id}/revoke-system-admin`, saToken, { role: 'USER', department_id: deptA }),
      await patch(`${sa.id}/role`, saToken, { role: 'USER' }),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CANNOT_MODIFY_SELF');
    }
    expect(await row(sa.id)).toEqual(before);
  });

  it('two System Admins deactivating each other at once cannot leave zero admins', async () => {
    const a = await fx.user('u-race-a', { role: 'SYSTEM_ADMIN' });
    const b = await fx.user('u-race-b', { role: 'SYSTEM_ADMIN' });
    const [ta, tb] = [await sign(a.id), await sign(b.id)];
    const results = await Promise.all([post(`${b.id}/deactivate`, ta), post(`${a.id}/deactivate`, tb)]);
    // The loser is refused either by the guard (401: already deactivated) or inside the lock (403), depending on timing.
    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect([401, 403]).toContain(statuses[1]);
    const active = (
      await fx.owner.query(`SELECT count(*)::int AS n FROM "User" WHERE id = ANY($1::uuid[]) AND status = 'ACTIVE'`, [[a.id, b.id]])
    ).rows[0].n;
    expect(active).toBe(1);
  });

  it('Department Admin is refused on pending, reopen and revoke-system-admin (403, no state change)', async () => {
    const rejected = await fx.user('u-da-denied', { status: 'REJECTED' });
    expect((await t.call('GET', '/api/admin/users/pending', { bearer: daToken })).status).toBe(403);
    expect((await post(`${rejected.id}/reopen`, daToken)).status).toBe(403);
    expect((await post(`${sa.id}/revoke-system-admin`, daToken, { role: 'USER', department_id: deptA })).status).toBe(403);
    expect((await row(rejected.id)).status).toBe('REJECTED');
  });

  it('reject needs a PENDING user (409), and deactivating a deactivated same-department user is 409', async () => {
    expect((await post(`${plain.id}/reject`, saToken)).status).toBe(409);
    const gone = await fx.user('u-da-twice', { role: 'USER', departmentId: deptA });
    expect((await post(`${gone.id}/deactivate`, daToken)).status).toBe(200);
    expect((await post(`${gone.id}/deactivate`, daToken)).status).toBe(409);
  });

  it('reactivating a System Admin keeps the department null', async () => {
    const other = await fx.user('u-sa-react', { role: 'SYSTEM_ADMIN' });
    await post(`${other.id}/deactivate`, saToken);
    const res = await post(`${other.id}/reactivate`, saToken);
    expect(res.body).toMatchObject({ status: 'ACTIVE', role: 'SYSTEM_ADMIN', department_id: null });
  });

  it('records the previous role and department when granting System Admin from a Department Admin', async () => {
    const u = await fx.user('u-grant-da', { role: 'DEPARTMENT_ADMIN', departmentId: deptB });
    await post(`${u.id}/grant-system-admin`, saToken);
    expect((await audit(u.id))[0].detail).toEqual({ previous_role: 'DEPARTMENT_ADMIN', previous_department_id: deptB });
  });

  it('rejects absurd or unknown list parameters with 400, not 500', async () => {
    for (const q of ['page=1e300', 'page=0', 'page=100001', 'unknown=1', 'page_size=0']) {
      expect((await t.call('GET', `/api/admin/users?${q}`, { bearer: saToken })).status, q).toBe(400);
    }
    expect((await t.call('GET', '/api/admin/users/pending?status=ACTIVE', { bearer: saToken })).status).toBe(400);
  });

  it('a Department Admin moved to another department loses the old department scope at once', async () => {
    const mover = await fx.user('u-mover', { role: 'DEPARTMENT_ADMIN', departmentId: deptA });
    const victim = await fx.user('u-mover-victim', { role: 'USER', departmentId: deptA });
    const moverToken = await sign(mover.id);
    await patch(`${mover.id}/department`, saToken, { department_id: deptB });
    expect((await post(`${victim.id}/deactivate`, moverToken)).status).toBe(403);
    expect((await row(victim.id)).status).toBe('ACTIVE');
  });

  it('404 for an unknown user and 400 for a malformed id', async () => {
    expect((await post('00000000-0000-4000-8000-000000000042/deactivate', saToken)).body.code).toBe('USER_NOT_FOUND');
    expect((await post('not-a-uuid/deactivate', saToken)).status).toBe(400);
  });
});
