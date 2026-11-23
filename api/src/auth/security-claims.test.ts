import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Fixtures, TEST_PASSWORD, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';

// Evidence for the GP2 report (P5): claims about passwords and token lifetimes that no other test
// asserts exactly. SYNTHETIC DATA ONLY; skipped when the database is not configured.

if (!dbEnabled) console.warn('[security-claims] database not configured — skipping.');

const DAY_MS = 86_400_000;
/** Anything that looks like a bcrypt hash, or a field that would carry one. */
const HASH_SHAPE = /\$2[aby]\$\d\d\$/;
const FORBIDDEN_KEYS = /"(password|password_hash|passwordHash|current_password|new_password)"\s*:/;

describe.skipIf(!dbEnabled)('security claims (P5)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let admin: { id: string; email: string };
  let member: { id: string; email: string };

  beforeAll(async () => {
    fx = new Fixtures();
    const dept = await fx.department('Claims');
    admin = await fx.user('claims-admin', { role: 'SYSTEM_ADMIN' });
    member = await fx.user('claims-user', { role: 'USER', departmentId: dept });
    t = await bootTestApp();
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.cleanup(undefined, t?.ip);
  });

  const webLogin = (email: string) => t.call('POST', '/api/auth/login', { body: { email, password: TEST_PASSWORD } });
  const extLogin = (email: string) => t.call('POST', '/api/extension/login', { body: { email, password: TEST_PASSWORD } });

  it('passwords and hashes are never returned: login, profile, user lists and the extension login', async () => {
    const web = await webLogin(admin.email);
    expect(web.status).toBe(200);
    const token = web.body.access_token as string;

    const responses = [
      web,
      await t.call('GET', '/api/auth/me', { bearer: token }),
      await t.call('GET', '/api/profile', { bearer: token }),
      await t.call('GET', '/api/admin/users?page_size=100', { bearer: token }),
      await t.call('GET', '/api/admin/users/pending', { bearer: token }),
      await extLogin(member.email),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200); // a refused request would pass the checks below for the wrong reason
      const text = res.text;
      expect(text.length).toBeGreaterThan(2);
      expect(text).not.toMatch(HASH_SHAPE);
      expect(text).not.toMatch(FORBIDDEN_KEYS);
      expect(text).not.toContain(TEST_PASSWORD);
    }
  });

  it('access tokens last 15 minutes (web) and 1 hour (extension), exactly', async () => {
    expect((await webLogin(member.email)).body.expires_in).toBe(900);
    expect((await extLogin(member.email)).body.expires_in).toBe(3600);
  });

  it('refresh tokens last 30 days: the web cookie and the stored extension token', async () => {
    const web = await webLogin(member.email);
    const cookie = web.cookies.find((c: string) => c.startsWith('hares_rt='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/Max-Age=2592000/i); // 30 days in seconds

    const before = Date.now();
    await extLogin(member.email);
    const { rows } = await fx.owner.query(
      `SELECT expires_at FROM "RefreshToken" WHERE user_id = $1 AND client_type = 'EXTENSION' ORDER BY created_at DESC LIMIT 1`,
      [member.id],
    );
    const lifetimeDays = (new Date(rows[0].expires_at).getTime() - before) / DAY_MS;
    expect(lifetimeDays).toBeGreaterThan(29.99);
    expect(lifetimeDays).toBeLessThan(30.01);
  });
});
