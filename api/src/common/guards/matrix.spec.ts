import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CAPABILITIES, CAPABILITY_MATRIX, ROLES, grantFor, type Role } from '@hares/contract';
import { TokenService } from '../../auth/token.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../../test/http-test-app';
import { routeTable, type RouteInfo } from '../../test/route-table';

// Parameterized RBAC matrix spec (B5a, WEB-NFR-003). Every route that carries
// a capability is called with a token for every role; each DENY cell of the
// matrix must answer 403 FORBIDDEN. The route list is read from the running
// app, so routes added by later batches are covered automatically.

/** GET/DELETE carry no body (a body on GET makes Node's parser answer 400). */
const bodyFor = (r: RouteInfo) => (r.method === 'GET' || r.method === 'DELETE' ? {} : { body: {} });

describe('capability matrix (contract)', () => {
  it('has a grant for every capability and role', () => {
    for (const c of CAPABILITIES) for (const r of ROLES) expect(CAPABILITY_MATRIX[c][r]).toBeDefined();
  });

  it('matches the explicit denials of SPEC-WEB §2', () => {
    const deniedForDeptAdmin = [
      'ORG_DASHBOARD_VIEW',
      'USERS_APPROVE',
      'USERS_ASSIGN',
      'USERS_REACTIVATE',
      'SYSTEM_ADMIN_GRANT',
      'DEPARTMENTS_MANAGE',
      'RULES_MANAGE',
      'POLICY_MANAGE',
      'AUDIT_VIEW',
    ] as const;
    for (const c of deniedForDeptAdmin) expect(grantFor(c, 'DEPARTMENT_ADMIN')).toBe('DENY');
    for (const c of CAPABILITIES) expect(grantFor(c, 'SYSTEM_ADMIN')).not.toBe('DENY');
    expect(grantFor('USERS_DEACTIVATE', 'DEPARTMENT_ADMIN')).toBe('SCOPED');
    expect(grantFor('PROFILE_VIEW', null)).toBe('DENY');
  });
});

if (!dbEnabled) console.warn('[matrix] database not configured — skipping the HTTP matrix.');

describe.skipIf(!dbEnabled)('RBAC matrix over every guarded route', () => {
  let t: TestApp;
  let fx: Fixtures;
  let routes: RouteInfo[];
  const tokens = {} as Record<Role, string>;

  beforeAll(async () => {
    fx = new Fixtures();
    const dept = await fx.department('Matrix');
    t = await bootTestApp();
    const users: Record<Role, { id: string }> = {
      USER: await fx.user('matrix-user', { role: 'USER', departmentId: dept }),
      DEPARTMENT_ADMIN: await fx.user('matrix-da', { role: 'DEPARTMENT_ADMIN', departmentId: dept }),
      SYSTEM_ADMIN: await fx.user('matrix-sa', { role: 'SYSTEM_ADMIN' }),
    };
    const tokenService = t.app.get(TokenService);
    for (const r of ROLES) tokens[r] = await tokenService.signAccess({ sub: users[r].id, tv: 0 }, 'web');
    routes = routeTable(t.app);
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  it('finds the guarded routes', () => {
    expect(routes.some((r) => r.rawPath === '/api/admin/departments')).toBe(true);
  });

  it('every /api/admin route declares a capability and is not public', () => {
    for (const r of routes.filter((x) => x.rawPath.startsWith('/api/admin'))) {
      expect(r.capability, `${r.method} ${r.rawPath}`).toBeDefined();
      expect(r.isPublic, `${r.method} ${r.rawPath}`).toBe(false);
    }
  });

  it('every non-public web route declares a capability (nothing ships open by accident)', () => {
    const open = routes.filter((r) => !r.isPublic && r.client === 'web' && !r.capability);
    expect(open.map((r) => `${r.method} ${r.rawPath}`)).toEqual([]);
  });

  it('answers 403 for every DENY cell; ALLOW cells are never 403', async () => {
    const checked: string[] = [];
    for (const route of routes.filter((r) => r.capability && r.client === 'web')) {
      for (const role of ROLES) {
        const res = await t.call(route.method, route.path, { bearer: tokens[role], ...bodyFor(route) });
        const label = `${role} ${route.method} ${route.rawPath}`;
        if (grantFor(route.capability!, role) === 'DENY') {
          expect(res.status, label).toBe(403);
          expect(res.body.code, label).toBe('FORBIDDEN');
        } else if (grantFor(route.capability!, role) === 'ALLOW') {
          expect(res.status, label).not.toBe(403);
        } else {
          // SCOPED: the guard lets the role in; the service may still refuse an
          // out-of-scope target (403 from the service, never a 401/500).
          expect([401, 500], label).not.toContain(res.status);
        }
        checked.push(label);
      }
    }
    expect(checked.length).toBeGreaterThan(0);
  });

  it('an extension token never passes a web capability route', async () => {
    const ext = await t.app.get(TokenService).signAccess({ sub: (await fx.user('matrix-ext', { role: 'SYSTEM_ADMIN' })).id, tv: 0 }, 'extension');
    for (const route of routes.filter((r) => r.capability)) {
      const res = await t.call(route.method, route.path, { bearer: ext, ...bodyFor(route) });
      expect([401, 403], `${route.method} ${route.rawPath}`).toContain(res.status);
    }
  });
});
