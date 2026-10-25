import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DepartmentListResponseSchema, DepartmentResponseSchema } from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';
import { DepartmentsService } from './departments.service';

// Departments (B5a): list with member counts, create, rename, deactivate, the
// audit entries they write, and deactivation as the ingestion block signal.
// Runs in the per-run test database. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[departments] database not configured — skipping.');

describe.skipIf(!dbEnabled)('departments (B5a)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let admin: { id: string };
  let token: string;
  let daToken: string;

  const audits = async (targetId: string) =>
    (
      await fx.owner.query(
        'SELECT acting_admin_id, action_type, detail FROM "AdminAuditLog" WHERE target_id = $1 ORDER BY created_at',
        [targetId],
      )
    ).rows;

  beforeAll(async () => {
    fx = new Fixtures();
    t = await bootTestApp();
    admin = await fx.user('dept-sa', { role: 'SYSTEM_ADMIN' });
    const own = await fx.department('DA home');
    const da = await fx.user('dept-da', { role: 'DEPARTMENT_ADMIN', departmentId: own });
    const tokens = t.app.get(TokenService);
    token = await tokens.signAccess({ sub: admin.id, tv: 0 }, 'web');
    daToken = await tokens.signAccess({ sub: da.id, tv: 0 }, 'web');
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  it('creates a department (201) and audits it', async () => {
    const res = await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `  Finance ${fx.salt} ` } });
    expect(res.status).toBe(201);
    expect(DepartmentResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({ name: `Finance ${fx.salt}`, active: true, member_count: 0 });
    expect(await audits(res.body.id)).toEqual([
      { acting_admin_id: admin.id, action_type: 'DEPARTMENT_CREATED', detail: { name: `Finance ${fx.salt}` } },
    ]);
  });

  it('refuses a duplicate name regardless of case (409) without an audit entry', async () => {
    const res = await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `FINANCE ${fx.salt}` } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPARTMENT_NAME_TAKEN');
    const { rows } = await fx.owner.query(
      `SELECT count(*)::int AS n FROM "AdminAuditLog" WHERE detail->>'name' = $1`,
      [`FINANCE ${fx.salt}`],
    );
    expect(rows[0].n).toBe(0);
  });

  it('lists departments with member counts', async () => {
    const dept = await fx.department('Counted');
    await fx.user('dept-m1', { departmentId: dept });
    await fx.user('dept-m2', { departmentId: dept });
    const res = await t.call('GET', '/api/admin/departments', { bearer: token });
    expect(res.status).toBe(200);
    expect(DepartmentListResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.find((d: { id: string }) => d.id === dept)?.member_count).toBe(2);
  });

  it('renames (audit keeps old and new name) and rejects a name taken by another department', async () => {
    const id = (await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `Ops ${fx.salt}` } })).body.id;
    const res = await t.call('PATCH', `/api/admin/departments/${id}`, { bearer: token, body: { name: `Operations ${fx.salt}` } });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`Operations ${fx.salt}`);
    const entries = await audits(id);
    expect(entries.at(-1)).toMatchObject({
      action_type: 'DEPARTMENT_RENAMED',
      detail: { old_name: `Ops ${fx.salt}`, new_name: `Operations ${fx.salt}` },
    });

    const clash = await t.call('PATCH', `/api/admin/departments/${id}`, { bearer: token, body: { name: `finance ${fx.salt}` } });
    expect(clash.status).toBe(409);
  });

  it('deactivates once (audited), then 409; the ingestion check sees it inactive', async () => {
    const id = (await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `Legal ${fx.salt}` } })).body.id;
    const svc = t.app.get(DepartmentsService);
    expect(await svc.isActive(id)).toBe(true);

    const res = await t.call('POST', `/api/admin/departments/${id}/deactivate`, { bearer: token });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(await svc.isActive(id)).toBe(false);

    const again = await t.call('POST', `/api/admin/departments/${id}/deactivate`, { bearer: token });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('DEPARTMENT_INACTIVE');
    expect((await audits(id)).filter((a) => a.action_type === 'DEPARTMENT_DEACTIVATED')).toHaveLength(1);
  });

  it('404 for an unknown id, 400 for a malformed id', async () => {
    const missing = await t.call('PATCH', '/api/admin/departments/00000000-0000-4000-8000-000000000001', {
      bearer: token,
      body: { name: 'Nope' },
    });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('DEPARTMENT_NOT_FOUND');
    const bad = await t.call('PATCH', '/api/admin/departments/not-a-uuid', { bearer: token, body: { name: 'Nope' } });
    expect(bad.status).toBe(400);
  });

  it('rename to the same name writes no audit entry; a case-only rename succeeds', async () => {
    const id = (await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `ENG ${fx.salt}` } })).body.id;
    const same = await t.call('PATCH', `/api/admin/departments/${id}`, { bearer: token, body: { name: `ENG ${fx.salt}` } });
    expect(same.status).toBe(200);
    expect(await audits(id)).toHaveLength(1);
    const cased = await t.call('PATCH', `/api/admin/departments/${id}`, { bearer: token, body: { name: `Eng ${fx.salt}` } });
    expect(cased.status).toBe(200);
    expect(cased.body.name).toBe(`Eng ${fx.salt}`);
    expect((await audits(id)).at(-1)?.action_type).toBe('DEPARTMENT_RENAMED');
  });

  it('an inactive department can still be renamed (history stays readable)', async () => {
    const id = (await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `Old ${fx.salt}` } })).body.id;
    await t.call('POST', `/api/admin/departments/${id}/deactivate`, { bearer: token });
    const res = await t.call('PATCH', `/api/admin/departments/${id}`, { bearer: token, body: { name: `Archive ${fx.salt}` } });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('deactivate rejects a non-empty body and changes nothing', async () => {
    const id = (await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `Body ${fx.salt}` } })).body.id;
    const res = await t.call('POST', `/api/admin/departments/${id}/deactivate`, { bearer: token, body: { active: true } });
    expect(res.status).toBe(400);
    const list = await t.call('GET', '/api/admin/departments', { bearer: token });
    expect(list.body.items.find((d: { id: string }) => d.id === id).active).toBe(true);
  });

  it('Department Admin cannot rename or deactivate either', async () => {
    const id = (await t.call('POST', '/api/admin/departments', { bearer: token, body: { name: `DA ${fx.salt}` } })).body.id;
    expect((await t.call('PATCH', `/api/admin/departments/${id}`, { bearer: daToken, body: { name: 'X' } })).status).toBe(403);
    expect((await t.call('POST', `/api/admin/departments/${id}/deactivate`, { bearer: daToken })).status).toBe(403);
  });

  it('Department Admin is read-only on departments: 403 on every route', async () => {
    expect((await t.call('GET', '/api/admin/departments', { bearer: daToken })).status).toBe(403);
    expect((await t.call('POST', '/api/admin/departments', { bearer: daToken, body: { name: 'X' } })).status).toBe(403);
  });
});
