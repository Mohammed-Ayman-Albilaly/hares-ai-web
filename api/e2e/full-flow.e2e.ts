import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// End-to-end flow against a REAL API process (tsx src/main.ts) and the
// throwaway database from global-setup. It walks the product's main story:
//   bootstrap admin signs in -> creates a department -> a visitor registers ->
//   admin approves -> the user's extension logs in, fetches the policy bundle
//   and posts events -> dashboards, logs, CSV and the audit trail show them ->
//   deactivation kills the session.
// SYNTHETIC DATA ONLY.
// ---------------------------------------------------------------------------

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = { email: 'bootstrap-admin@synthetic.test', password: 'Bootstrap#Pass1' };
const USER_PASSWORD = 'E2e#Password1';

let child: ChildProcess;
let base = '';
let log = '';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function call(method: string, p: string, opts: { body?: unknown; bearer?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  return { status: res.status, body, text, headers: res.headers };
}

describe.skipIf(!process.env.HARES_TEST_DB)('end to end: real server process', () => {
  beforeAll(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}/api`;
    const tsx = path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    child = spawn(process.execPath, [tsx, 'src/main.ts'], {
      cwd: API_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: String(port),
        JWT_ACCESS_SECRET: 'e2e-secret-0123456789-0123456789-0123456789',
        CORS_ORIGIN: 'http://localhost:1420',
        JOBS: 'off',
        RATE_LIMITS: 'on',
      },
    });
    child.stdout?.on('data', (d) => (log += String(d)));
    child.stderr?.on('data', (d) => (log += String(d)));

    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        if ((await fetch(`${base}/health`)).ok) break;
      } catch {
        /* not up yet */
      }
      if (child.exitCode !== null) throw new Error(`API exited early:\n${log}`);
      if (Date.now() > deadline) throw new Error(`API did not start:\n${log}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }, 90_000);

  afterAll(async () => {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
  });

  const state: { admin?: string; deptId?: string; userId?: string; ext?: { access: string; refresh: string }; webAccess?: string } = {};
  const email = `e2e-${randomUUID().slice(0, 8)}@synthetic.test`;

  it('health answers and unknown routes use the error envelope', async () => {
    const h = await call('GET', '/health');
    expect(h.status).toBe(200);
    expect(h.body.status).toBe('ok');
    const missing = await call('GET', '/nonexistent');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
    expect(missing.headers.get('x-request-id')).toBeTruthy();
  });

  it('the bootstrap System Admin signs in', async () => {
    const res = await call('POST', '/auth/login', { body: ADMIN });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('SYSTEM_ADMIN');
    expect(res.headers.get('set-cookie')).toMatch(/hares_rt=.*HttpOnly.*SameSite=Strict/i);
    state.admin = res.body.access_token;
  });

  it('admin creates a department; a visitor registers and stays PENDING', async () => {
    const dept = await call('POST', '/admin/departments', { bearer: state.admin, body: { name: `E2E Dept ${Date.now()}` } });
    expect(dept.status).toBe(201);
    state.deptId = dept.body.id;

    const reg = await call('POST', '/auth/register', { body: { full_name: 'E2E User', email, password: USER_PASSWORD } });
    expect(reg.status).toBe(201);
    const early = await call('POST', '/auth/login', { body: { email, password: USER_PASSWORD } });
    expect(early.status).toBe(401);
    expect(early.body.code).toBe('ACCOUNT_PENDING');
  });

  it('admin approves; the user signs in on the web and in the extension', async () => {
    const pending = await call('GET', '/admin/users/pending', { bearer: state.admin });
    const row = pending.body.items.find((u: { email: string }) => u.email === email);
    expect(row).toBeTruthy();
    state.userId = row.id;
    const approved = await call('POST', `/admin/users/${state.userId}/approve`, {
      bearer: state.admin,
      body: { department_id: state.deptId, role: 'USER' },
    });
    expect(approved.body).toMatchObject({ status: 'ACTIVE', role: 'USER' });

    const web = await call('POST', '/auth/login', { body: { email, password: USER_PASSWORD } });
    expect(web.status).toBe(200);
    state.webAccess = web.body.access_token;
    const ext = await call('POST', '/extension/login', { body: { email, password: USER_PASSWORD } });
    expect(ext.status).toBe(200);
    state.ext = { access: ext.body.access_token, refresh: ext.body.refresh_token };
    expect((await call('GET', '/policy/bundle', { bearer: state.webAccess })).status).toBe(401); // web token refused
  });

  it('admin sets a policy; the extension fetches the bundle and gets 304 on the same version', async () => {
    const set = await call('PUT', '/admin/policy/org/CONTACT_INFO', { bearer: state.admin, body: { action: 'BLOCK', enabled: true } });
    expect(set.status).toBe(200);
    const bundle = await call('GET', '/policy/bundle', { bearer: state.ext!.access });
    expect(bundle.status).toBe(200);
    expect(bundle.body.policy).toHaveLength(24);
    expect(bundle.body.policy.find((e: { category_code: string }) => e.category_code === 'CONTACT_INFO').action).toBe('BLOCK');
    const etag = bundle.headers.get('etag')!;
    expect((await call('GET', '/policy/bundle', { bearer: state.ext!.access, headers: { 'if-none-match': etag } })).status).toBe(304);
  });

  it('the extension posts events (idempotent); prompt-text fields are rejected', async () => {
    const e = (over: Record<string, unknown> = {}) => ({
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
    const first = e();
    expect((await call('POST', '/logs', { bearer: state.ext!.access, body: first })).status).toBe(201);
    expect((await call('POST', '/logs', { bearer: state.ext!.access, body: first })).status).toBe(200);
    expect((await call('POST', '/logs', { bearer: state.ext!.access, body: e({ risk_level: 'MEDIUM', action: 'WARNED', platform: 'GEMINI', user_decision: 'SUBMITTED_ANYWAY' }) })).status).toBe(201);
    const bad = await call('POST', '/logs', { bearer: state.ext!.access, body: e({ prompt: 'secret text' }) });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('UNKNOWN_FIELD');
    expect(bad.text).not.toContain('secret text');
  });

  it('dashboards, logs, CSV and the audit trail reflect the activity', async () => {
    const dept = await call('GET', `/dashboard/department/summary?department_id=${state.deptId}`, { bearer: state.admin });
    expect(dept.body.totals).toMatchObject({ total_events: 2, blocked: 1, warned: 1, high_risk: 1 });
    const org = await call('GET', '/dashboard/org/summary', { bearer: state.admin });
    expect(org.body.departments.some((d: { department_id: string }) => d.department_id === state.deptId)).toBe(true);

    const mine = await call('GET', '/dashboard/mine/summary', { bearer: state.webAccess });
    expect(mine.body.totals.total_events).toBe(2);
    const blocked = await call('GET', '/logs/mine?action=BLOCKED', { bearer: state.webAccess });
    expect(blocked.body.items).toHaveLength(1);

    const csv = await fetch(`${base}/admin/logs/export?department_id=${state.deptId}`, { headers: { authorization: `Bearer ${state.admin}` } });
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    const text = await csv.text();
    expect(text.trim().split('\r\n')).toHaveLength(3);

    const audit = await call('GET', '/admin/audit?page_size=50', { bearer: state.admin });
    const kinds = audit.body.items.map((i: { action_type: string }) => i.action_type);
    expect(kinds).toEqual(expect.arrayContaining(['DEPARTMENT_CREATED', 'USER_APPROVED', 'POLICY_CHANGED']));
  });

  it('role walls hold: the user is refused on every admin endpoint', async () => {
    for (const p of ['/admin/users', '/admin/departments', '/admin/audit', '/admin/logs', '/admin/rules', '/admin/policy/org', '/dashboard/org/summary']) {
      expect((await call('GET', p, { bearer: state.webAccess })).status, p).toBe(403);
    }
  });

  it('deactivation ends every session at once', async () => {
    const res = await call('POST', `/admin/users/${state.userId}/deactivate`, { bearer: state.admin });
    expect(res.body.status).toBe('DEACTIVATED');
    expect((await call('GET', '/profile', { bearer: state.webAccess })).body.code).toBe('TOKEN_REVOKED');
    expect((await call('GET', '/policy/bundle', { bearer: state.ext!.access })).status).toBe(401);
    expect((await call('POST', '/extension/refresh', { body: { refresh_token: state.ext!.refresh } })).status).toBe(401);
    expect((await call('POST', '/auth/login', { body: { email, password: USER_PASSWORD } })).body.code).toBe('ACCOUNT_INACTIVE');
  });

  it('the server log holds no password, token or prompt text', () => {
    expect(log).not.toContain(USER_PASSWORD);
    expect(log).not.toContain(ADMIN.password);
    expect(log).not.toContain('secret text');
    expect(log).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./); // no JWT
  });
});
