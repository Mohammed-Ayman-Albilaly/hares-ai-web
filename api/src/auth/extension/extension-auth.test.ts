import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { SignJWT } from 'jose';
import { ExtensionAuthResponseSchema, ExtensionErrorEnvelopeSchema } from '@hares/contract';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { ExtensionGuard, ExtensionOnly } from '../../common/guards/extension.guard';
import type { AuthUser } from '../../common/auth-user';
import { Fixtures, TEST_PASSWORD, bootTestApp, dbEnabled, type TestApp } from '../../test/http-test-app';

// Extension auth suite (B4b): login, rotation on each use, reuse detection that
// revokes the whole family, logout, and strict separation of web vs extension
// tokens. SYNTHETIC DATA ONLY; skipped when the database is not configured.

if (!dbEnabled) console.warn('[extension-auth] database not configured — skipping.');

/** A probe route that only extension tokens may call. */
@ExtensionOnly()
@Controller('test-probe/extension')
class ExtensionProbeController {
  @Get()
  who(@CurrentUser() user: AuthUser) {
    return { id: user.id, client: user.client };
  }
}

/** ExtensionGuard alone (no aud metadata): proves the guard itself refuses web tokens. */
@UseGuards(ExtensionGuard)
@Controller('test-probe/guard-only')
class GuardOnlyProbeController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe.skipIf(!dbEnabled)('extension auth (B4b)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let active: { id: string; email: string };

  const extLogin = (email = active.email, password = TEST_PASSWORD) =>
    t.call('POST', '/api/extension/login', { body: { email, password } });
  const extRefresh = (refresh_token: string) => t.call('POST', '/api/extension/refresh', { body: { refresh_token } });

  beforeAll(async () => {
    fx = new Fixtures();
    const dept = await fx.department();
    active = await fx.user('ext-active', { departmentId: dept });
    await fx.user('ext-pending', { status: 'PENDING' });
    await fx.user('ext-deact', { status: 'DEACTIVATED', departmentId: dept });
    await fx.user('ext-rejected', { status: 'REJECTED' });
    t = await bootTestApp({ controllers: [ExtensionProbeController, GuardOnlyProbeController] });
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.cleanup(undefined, t?.ip);
  });

  it('logs in and returns an access token (<= 1h) and a refresh token in the body', async () => {
    const res = await extLogin(active.email.toUpperCase());
    expect(res.status).toBe(200);
    expect(ExtensionAuthResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.expires_in).toBeLessThanOrEqual(3600);
    expect(res.cookies).toHaveLength(0);
  });

  it('uses the extension error codes for denied logins', async () => {
    const wrong = await extLogin(active.email, 'Wrong#Pass1');
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(ExtensionErrorEnvelopeSchema.safeParse(wrong.body).success).toBe(true);

    fx.emails.push(fx.email('ext-nobody'));
    const unknown = await extLogin(fx.email('ext-nobody'));
    expect(unknown.status).toBe(401);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.message).toBe(wrong.body.message);

    expect((await extLogin(fx.email('ext-pending'))).body.code).toBe('ACCOUNT_NO_ACCESS');
    expect((await extLogin(fx.email('ext-rejected'))).body.code).toBe('ACCOUNT_NO_ACCESS');
    expect((await extLogin(fx.email('ext-deact'))).body.code).toBe('ACCOUNT_INACTIVE');

    const missing = await t.call('POST', '/api/extension/login', { body: { email: active.email } });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns a contract error code for a malformed JSON body', async () => {
    const res = await t.call('POST', '/api/extension/login', {
      rawBody: '{"email": ',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(ExtensionErrorEnvelopeSchema.safeParse(res.body).success).toBe(true);
  });

  it('stores only the SHA-256 hash of the refresh token', async () => {
    const raw = (await extLogin()).body.refresh_token as string;
    const hash = createHash('sha256').update(raw).digest('hex');
    const { rows } = await fx.owner.query(
      'SELECT client_type FROM "RefreshToken" WHERE token_hash = $1',
      [hash],
    );
    expect(rows).toEqual([{ client_type: 'EXTENSION' }]);
    const leaked = await fx.owner.query('SELECT 1 FROM "RefreshToken" WHERE token_hash = $1', [raw]);
    expect(leaked.rowCount).toBe(0);
  });

  it('answers TOKEN_EXPIRED for an expired extension access token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(active.id)
      .setIssuer('hares-api')
      .setAudience('extension')
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 60)
      .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? ''));
    const res = await t.call('GET', '/api/test-probe/extension', { bearer: expired });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('answers INVALID_TOKEN for an expired refresh token', async () => {
    const raw = (await extLogin()).body.refresh_token as string;
    const hash = createHash('sha256').update(raw).digest('hex');
    await fx.owner.query(
      `UPDATE "RefreshToken" SET created_at = now() - interval '31 days', expires_at = now() - interval '1 day' WHERE token_hash = $1`,
      [hash],
    );
    const res = await extRefresh(raw);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('ExtensionGuard by itself refuses a web token with 403 FORBIDDEN', async () => {
    const web = await t.call('POST', '/api/auth/login', { body: { email: active.email, password: TEST_PASSWORD } });
    const res = await t.call('GET', '/api/test-probe/guard-only', { bearer: web.body.access_token });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('rotates on each use and revokes the whole family when a used token is replayed', async () => {
    const first = (await extLogin()).body.refresh_token as string;
    const r1 = await extRefresh(first);
    expect(r1.status).toBe(200);
    const second = r1.body.refresh_token as string;
    expect(second).not.toBe(first);
    const r2 = await extRefresh(second);
    expect(r2.status).toBe(200);
    const third = r2.body.refresh_token as string;

    const replay = await extRefresh(first);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_REUSED');

    const after = await extRefresh(third);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('TOKEN_REVOKED');
  });

  it('logout revokes the family (204); a second logout or refresh gets 401', async () => {
    const token = (await extLogin()).body.refresh_token as string;
    expect((await t.call('POST', '/api/extension/logout', { body: { refresh_token: token } })).status).toBe(204);
    const again = await t.call('POST', '/api/extension/logout', { body: { refresh_token: token } });
    expect(again.status).toBe(401);
    expect(again.body.code).toBe('INVALID_TOKEN');
    expect((await extRefresh(token)).body.code).toBe('TOKEN_REVOKED');
  });

  it('keeps web and extension tokens apart in both directions', async () => {
    const ext = (await extLogin()).body;
    const web = await t.call('POST', '/api/auth/login', { body: { email: active.email, password: TEST_PASSWORD } });
    const webAccess = web.body.access_token as string;
    const webRefresh = web.cookies[0].split(';')[0].split('=')[1];

    // Extension endpoint: extension token OK, web token refused.
    const ok = await t.call('GET', '/api/test-probe/extension', { bearer: ext.access_token });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id: active.id, client: 'extension' });
    const denied = await t.call('GET', '/api/test-probe/extension', { bearer: webAccess });
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('INVALID_TOKEN');

    // Web endpoint: extension access token refused.
    expect((await t.call('GET', '/api/auth/me', { bearer: ext.access_token })).status).toBe(401);

    // Refresh tokens cannot cross over either.
    expect((await extRefresh(webRefresh)).body.code).toBe('INVALID_TOKEN');
    const cross = await t.call('POST', '/api/auth/refresh', { headers: { cookie: `hares_rt=${ext.refresh_token}` } });
    expect(cross.body.code).toBe('INVALID_TOKEN');
  });

  it('revokes extension tokens immediately when token_version changes (WEB-FR-059)', async () => {
    const ext = (await extLogin()).body;
    await fx.owner.query('UPDATE "User" SET token_version = token_version + 1 WHERE id = $1', [active.id]);
    const probe = await t.call('GET', '/api/test-probe/extension', { bearer: ext.access_token });
    expect(probe.status).toBe(401);
    expect(probe.body.code).toBe('TOKEN_REVOKED');
    expect((await extRefresh(ext.refresh_token)).body.code).toBe('TOKEN_REVOKED');
  });
});
