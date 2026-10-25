import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { SignJWT } from 'jose';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LoginResponseSchema, REFRESH_COOKIE_NAME, UserPublicSchema } from '@hares/contract';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

// ---------------------------------------------------------------------------
// Web auth integration suite (B4a): register -> PENDING, login, /auth/me,
// refresh rotation + reuse detection, logout, and the JwtAuthGuard checks.
//
// It boots the real AppModule against the dev database (the app connects as
// hares_app via APP_DATABASE_URL). Fixtures are created and removed through the
// owner role (DATABASE_URL). SYNTHETIC DATA ONLY; everything is cleaned up.
// Skipped (with a message) when the database URLs are not configured.
// ---------------------------------------------------------------------------

const ownerUrl = process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;
const enabled = Boolean(ownerUrl && appUrl);
if (!enabled) {
  console.warn('[auth] DATABASE_URL / APP_DATABASE_URL not set — skipping the web auth suite.');
}

const SALT = randomUUID().slice(0, 8);
const PASSWORD = 'Synthetic#Pass1';
const email = (tag: string) => `auth-${tag}-${SALT}@synthetic.test`;

interface Res {
  status: number;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  cookies: string[];
}

describe.skipIf(!enabled)('web auth (B4a)', () => {
  let app: NestExpressApplication;
  let owner: Pool;
  let port: number;
  const departmentId = randomUUID();
  const activeId = randomUUID();

  function call(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Res> {
    const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            ...(payload ? { 'content-type': 'application/json' } : {}),
            ...opts.headers,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              body: data ? JSON.parse(data) : undefined,
              cookies: res.headers['set-cookie'] ?? [],
            }),
          );
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  /** Extract the refresh token value from Set-Cookie headers. */
  function refreshCookie(res: Res): string | undefined {
    const c = res.cookies.find((h) => h.startsWith(`${REFRESH_COOKIE_NAME}=`));
    return c?.split(';')[0].slice(REFRESH_COOKIE_NAME.length + 1) || undefined;
  }
  const cookieHeader = (token: string) => ({ cookie: `${REFRESH_COOKIE_NAME}=${token}` });
  const login = (e = email('active')) => call('POST', '/api/auth/login', { body: { email: e, password: PASSWORD } });

  beforeAll(async () => {
    owner = new Pool({ connectionString: ownerUrl });
    const hash = await bcrypt.hash(PASSWORD, 12);
    await owner.query('INSERT INTO "Department" (id, name, active) VALUES ($1, $2, true)', [departmentId, `Auth Dept ${SALT}`]);
    await owner.query(
      `INSERT INTO "User" (id, full_name, email, password_hash, role, department_id, status, registered_at)
       VALUES ($1, 'Synthetic Active', $2, $3, 'USER', $4, 'ACTIVE', now())`,
      [activeId, email('active'), hash, departmentId],
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureApp(app);
    await app.init();
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (owner) {
      const users = `SELECT id FROM "User" WHERE email LIKE $1`;
      await owner.query(`DELETE FROM "RefreshToken" WHERE user_id IN (${users})`, [`%-${SALT}@synthetic.test`]);
      await owner.query(`DELETE FROM "User" WHERE email LIKE $1`, [`%-${SALT}@synthetic.test`]);
      await owner.query('DELETE FROM "Department" WHERE id = $1', [departmentId]);
      await owner.end();
    }
  });

  // ---------- register ----------

  it('registers a PENDING account with no role/department and a bcrypt-12 hash', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { full_name: 'Synthetic Pending', email: email('pending').toUpperCase(), password: PASSWORD },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'PENDING' });

    const { rows } = await owner.query('SELECT status, role, department_id, email, password_hash FROM "User" WHERE email = $1', [
      email('pending'),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'PENDING', role: null, department_id: null });
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('rejects a duplicate email regardless of case with 409 EMAIL_TAKEN', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { full_name: 'Dup', email: email('active').replace('auth', 'AUTH'), password: PASSWORD },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a weak password with field details that never echo the value', async () => {
    const weak = 'weakpass';
    const res = await call('POST', '/api/auth/register', {
      body: { full_name: 'Weak', email: email('weak'), password: weak },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.password).toContain('password.needs_uppercase');
    expect(JSON.stringify(res.body)).not.toContain(weak);
  });

  it('rejects unknown fields such as a self-assigned role', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { full_name: 'X', email: email('role'), password: PASSWORD, role: 'SYSTEM_ADMIN' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects a password longer than 72 bytes at register', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { full_name: 'Long', email: email('long'), password: 'Aa1#' + 'x'.repeat(69) },
    });
    expect(res.status).toBe(400);
    expect(res.body.details.password).toContain('password.too_long');
  });

  it('reports unknown fields with a fixed key, never the key names sent', async () => {
    const res = await call('POST', '/api/auth/login', {
      body: { email: email('active'), password: PASSWORD, prompt_text_probe: 1 },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('prompt_text_probe');
    expect(res.body.details._).toContain('request.unknown_field');
  });

  // ---------- login ----------

  it('blocks login and register from a foreign Origin (login CSRF)', async () => {
    const headers = { origin: 'https://evil.example' };
    const l = await call('POST', '/api/auth/login', { body: { email: email('active'), password: PASSWORD }, headers });
    expect(l.status).toBe(403);
    expect(l.body.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(l.cookies).toHaveLength(0);
    const r = await call('POST', '/api/auth/register', {
      body: { full_name: 'X', email: email('csrf'), password: PASSWORD },
      headers,
    });
    expect(r.status).toBe(403);
  });

  it('answers a wrong password and an unknown email identically', async () => {
    const wrong = await call('POST', '/api/auth/login', { body: { email: email('active'), password: 'Wrong#Pass1' } });
    const unknown = await call('POST', '/api/auth/login', { body: { email: email('nobody'), password: PASSWORD } });
    for (const r of [wrong, unknown]) {
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('INVALID_CREDENTIALS');
      expect(r.cookies).toHaveLength(0);
    }
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('requires both login fields (400 VALIDATION_ERROR)', async () => {
    const res = await call('POST', '/api/auth/login', { body: { email: email('active') } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('denies a PENDING account with the right password and issues no session', async () => {
    const res = await login(email('pending'));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_PENDING');
    expect(res.cookies).toHaveLength(0);
  });

  it('logs in an ACTIVE account: access token in the body, refresh in an HttpOnly Strict cookie', async () => {
    const res = await login(email('active').toUpperCase());
    expect(res.status).toBe(200);
    expect(LoginResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.expires_in).toBe(900);
    expect(res.body.user).toMatchObject({ id: activeId, role: 'USER', department_id: departmentId });
    expect(JSON.stringify(res.body)).not.toMatch(/password|token_version|refresh_token/);

    const cookie = res.cookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`)) ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  // ---------- guard + /auth/me ----------

  it('serves /auth/me with a valid bearer token and rejects missing or garbage tokens', async () => {
    const { body } = await login();
    const me = await call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${body.access_token}` } });
    expect(me.status).toBe(200);
    expect(UserPublicSchema.safeParse(me.body).success).toBe(true);

    const none = await call('GET', '/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body.code).toBe('INVALID_TOKEN');

    const junk = await call('GET', '/api/auth/me', { headers: { authorization: 'Bearer not.a.jwt' } });
    expect(junk.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const key = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? '');
    const expired = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(activeId)
      .setIssuer('hares-api')
      .setAudience('web')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    const res = await call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${expired}` } });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects an extension-audience token on a web route', async () => {
    const ext = await app.get(TokenService).signAccess({ sub: activeId, tv: 0 }, 'extension');
    const res = await call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${ext}` } });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  // ---------- refresh ----------

  it('rotates the refresh cookie and detects reuse by revoking the whole family', async () => {
    const first = refreshCookie(await login())!;
    const r1 = await call('POST', '/api/auth/refresh', { headers: cookieHeader(first) });
    expect(r1.status).toBe(200);
    expect(LoginResponseSchema.safeParse(r1.body).success).toBe(true);
    const second = refreshCookie(r1)!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    // Replay the used token: reuse detected, family revoked.
    const replay = await call('POST', '/api/auth/refresh', { headers: cookieHeader(first) });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_REUSED');

    // The legitimate successor is now dead too.
    const after = await call('POST', '/api/auth/refresh', { headers: cookieHeader(second) });
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('TOKEN_REVOKED');
  });

  it('lets only one of two concurrent refreshes with the same token succeed', async () => {
    const token = refreshCookie(await login())!;
    const results = await Promise.all([
      call('POST', '/api/auth/refresh', { headers: cookieHeader(token) }),
      call('POST', '/api/auth/refresh', { headers: cookieHeader(token) }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.find((r) => r.status !== 200)?.body.code).toBe('REFRESH_REUSED');
  });

  it('never lets a logout racing a refresh leave a live successor token', async () => {
    for (let i = 0; i < 5; i++) {
      const token = refreshCookie(await login())!;
      const [refreshed] = await Promise.all([
        call('POST', '/api/auth/refresh', { headers: cookieHeader(token) }),
        call('POST', '/api/auth/logout', { headers: cookieHeader(token) }),
      ]);
      const successor = refreshCookie(refreshed);
      if (refreshed.status === 200 && successor) {
        const again = await call('POST', '/api/auth/refresh', { headers: cookieHeader(successor) });
        expect(again.status).toBe(401);
      }
    }
  });

  it('rejects an extension refresh token on the web refresh route', async () => {
    const ext = await app.get(RefreshTokenService).issue(activeId, 0, 'extension');
    const res = await call('POST', '/api/auth/refresh', { headers: cookieHeader(ext) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('refuses refresh without a cookie, with an unknown cookie, or from a foreign Origin', async () => {
    const none = await call('POST', '/api/auth/refresh');
    expect(none.status).toBe(401);
    expect(none.body.code).toBe('INVALID_TOKEN');

    const unknown = await call('POST', '/api/auth/refresh', { headers: cookieHeader('x'.repeat(43)) });
    expect(unknown.body.code).toBe('INVALID_TOKEN');

    const token = refreshCookie(await login())!;
    const foreign = await call('POST', '/api/auth/refresh', {
      headers: { ...cookieHeader(token), origin: 'https://evil.example' },
    });
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  // ---------- logout ----------

  it('logout returns 204, clears the cookie, and revokes the family', async () => {
    const token = refreshCookie(await login())!;
    const out = await call('POST', '/api/auth/logout', { headers: cookieHeader(token) });
    expect(out.status).toBe(204);
    const cleared = out.cookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`)) ?? '';
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

    const res = await call('POST', '/api/auth/refresh', { headers: cookieHeader(token) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REVOKED');

    // Logging out again (or without a cookie) is still a clean 204.
    expect((await call('POST', '/api/auth/logout')).status).toBe(204);
  });

  // ---------- revocation (token_version + status) ----------

  it('revokes access and refresh tokens when token_version changes, and denies non-ACTIVE users', async () => {
    const res = await login();
    const access = res.body.access_token as string;
    const token = refreshCookie(res)!;

    await owner.query('UPDATE "User" SET token_version = token_version + 1 WHERE id = $1', [activeId]);
    const me = await call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${access}` } });
    expect(me.status).toBe(401);
    expect(me.body.code).toBe('TOKEN_REVOKED');
    const refreshed = await call('POST', '/api/auth/refresh', { headers: cookieHeader(token) });
    expect(refreshed.body.code).toBe('TOKEN_REVOKED');

    // A fresh token, then the account is deactivated without a version bump.
    const fresh = (await login()).body.access_token as string;
    await owner.query(`UPDATE "User" SET status = 'DEACTIVATED' WHERE id = $1`, [activeId]);
    try {
      const denied = await call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${fresh}` } });
      expect(denied.status).toBe(401);
      expect(denied.body.code).toBe('ACCOUNT_INACTIVE');
      const relogin = await login();
      expect(relogin.body.code).toBe('ACCOUNT_INACTIVE');
    } finally {
      await owner.query(`UPDATE "User" SET status = 'ACTIVE' WHERE id = $1`, [activeId]);
    }
  });
});
