import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { MailerService, type MailMessage } from '../../mail/mailer.service';
import { Fixtures, TEST_PASSWORD, bootTestApp, clearThrottle, dbEnabled, type TestApp } from '../../test/http-test-app';
import { throttleKeys } from '../login-failure-store';
import { PasswordResetService } from './password-reset.service';

// Forgot / reset / change password and the progressive login throttle (B4c).
// The mailer is replaced by an in-memory outbox. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[password] database not configured — skipping.');

const NEW_PASSWORD = 'Another#Pass2';

describe.skipIf(!dbEnabled)('password reset, change and login throttle (B4c)', () => {
  let t: TestApp;
  let fx: Fixtures;
  const outbox: MailMessage[] = [];
  let dept: string;

  const forgot = (email: string) => t.call('POST', '/api/auth/forgot-password', { body: { email } });
  // Each test can use its own source address so the per-IP counter starts at 0.
  let sourceIp = '';
  const usedIps: string[] = [];
  const freshSource = () => {
    sourceIp = `10.250.${usedIps.length + 1}.${Math.floor(Math.random() * 250) + 1}`;
    usedIps.push(sourceIp);
    return sourceIp;
  };
  const login = (email: string, password = TEST_PASSWORD, path = '/api/auth/login') =>
    t.call('POST', path, { body: { email, password }, headers: sourceIp ? { 'x-forwarded-for': sourceIp } : {} });
  const idle = () => t.app.get(PasswordResetService).whenIdle();

  /** Pull the token out of the last captured email's link. */
  function tokenFromMail(m: MailMessage): string {
    const match = /reset-password#token=([A-Za-z0-9_-]{43})/.exec(m.text);
    if (!match) throw new Error('no reset link in the email');
    return match[1];
  }

  beforeAll(async () => {
    fx = new Fixtures();
    dept = await fx.department();
    t = await bootTestApp({
      override: (b) =>
        b.overrideProvider(MailerService).useValue({
          send: async (m: MailMessage) => {
            outbox.push(m);
          },
        }),
    });
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    for (const ip of usedIps) await clearThrottle(fx.owner, fx.emails, ip);
    await fx?.cleanup(undefined, t?.ip);
  });

  beforeEach(() => {
    outbox.length = 0;
  });

  // ---------- forgot ----------

  it('answers 202 the same way for a registered and an unknown email', async () => {
    const user = await fx.user('reset-known', { departmentId: dept });
    const known = await forgot(user.email);
    const unknown = await forgot(fx.email('reset-nobody'));
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    await idle();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
  });

  it('sends nothing to PENDING or DEACTIVATED accounts', async () => {
    const p = await fx.user('reset-pending', { status: 'PENDING' });
    const d = await fx.user('reset-deact', { status: 'DEACTIVATED', departmentId: dept });
    await forgot(p.email);
    await forgot(d.email);
    await idle();
    expect(outbox).toHaveLength(0);
  });

  it('the email contains only the link and expiry: no password, no name, no token hash', async () => {
    const user = await fx.user('reset-content', { departmentId: dept });
    await forgot(user.email);
    await idle();
    const m = outbox[0];
    const token = tokenFromMail(m);
    const hash = createHash('sha256').update(token).digest('hex');
    const all = `${m.subject}\n${m.text}\n${m.html}`;
    expect(all).toContain('/reset-password#token=');
    expect(all).toMatch(/30/);
    for (const forbidden of [TEST_PASSWORD, 'Synthetic reset-content', hash, '{{', '}}', 'prompt']) {
      expect(all).not.toContain(forbidden);
    }
    // Only one distinct URL appears (the reset link).
    const urls = new Set(all.match(/https?:\/\/[^\s"<]+/g));
    expect(urls.size).toBe(1);
  });

  it('stores only the token hash, with a 30-minute expiry', async () => {
    const user = await fx.user('reset-hash', { departmentId: dept });
    await forgot(user.email);
    await idle();
    const token = tokenFromMail(outbox[0]);
    const { rows } = await fx.owner.query(
      `SELECT token_hash, extract(epoch FROM expires_at - created_at) AS ttl FROM "PasswordResetToken" WHERE user_id = $1`,
      [user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(Math.round(Number(rows[0].ttl))).toBe(1800);
  });

  it('limits reset emails to 3 per account per 15 minutes', async () => {
    const user = await fx.user('reset-limit', { departmentId: dept });
    for (let i = 0; i < 5; i++) await forgot(user.email);
    await idle();
    expect(outbox).toHaveLength(3);
  });

  // ---------- reset ----------

  it('resets once, revokes every session, then rejects reuse of the link', async () => {
    const user = await fx.user('reset-use', { departmentId: dept });
    const session = await login(user.email);
    const ext = await login(user.email, TEST_PASSWORD, '/api/extension/login');
    await forgot(user.email);
    await idle();
    const token = tokenFromMail(outbox[0]);

    const ok = await t.call('POST', '/api/auth/reset-password', { body: { token, new_password: NEW_PASSWORD } });
    expect(ok.status).toBe(204);

    // Old sessions are dead (token_version bumped, families revoked).
    expect((await t.call('GET', '/api/auth/me', { bearer: session.body.access_token })).body.code).toBe('TOKEN_REVOKED');
    expect(
      (await t.call('POST', '/api/extension/refresh', { body: { refresh_token: ext.body.refresh_token } })).status,
    ).toBe(401);

    expect((await login(user.email)).status).toBe(401);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);

    const again = await t.call('POST', '/api/auth/reset-password', { body: { token, new_password: 'Third#Pass3' } });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects an expired token and a superseded token', async () => {
    const user = await fx.user('reset-exp', { departmentId: dept });
    await forgot(user.email);
    await idle();
    const first = tokenFromMail(outbox[0]);
    await forgot(user.email);
    await idle();
    const second = tokenFromMail(outbox[1]);

    const superseded = await t.call('POST', '/api/auth/reset-password', { body: { token: first, new_password: NEW_PASSWORD } });
    expect(superseded.body.code).toBe('RESET_TOKEN_INVALID');

    await fx.owner.query(
      `UPDATE "PasswordResetToken" SET created_at = now() - interval '1 hour', expires_at = now() - interval '1 minute' WHERE user_id = $1`,
      [user.id],
    );
    const expired = await t.call('POST', '/api/auth/reset-password', { body: { token: second, new_password: NEW_PASSWORD } });
    expect(expired.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('applies the password policy to the new password without echoing it', async () => {
    const res = await t.call('POST', '/api/auth/reset-password', {
      body: { token: 'a'.repeat(43), new_password: 'weakpass' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('weakpass');
  });

  // ---------- change ----------

  it('changes the password with the current one, ends other sessions and issues a new one', async () => {
    const user = await fx.user('change', { departmentId: dept });
    const a = await login(user.email);
    const b = await login(user.email);

    const wrong = await t.call('POST', '/api/auth/change-password', {
      bearer: a.body.access_token,
      body: { current_password: 'Wrong#Pass9', new_password: NEW_PASSWORD },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');

    const ok = await t.call('POST', '/api/auth/change-password', {
      bearer: a.body.access_token,
      body: { current_password: TEST_PASSWORD, new_password: NEW_PASSWORD },
    });
    expect(ok.status).toBe(200);
    expect(ok.cookies.some((c) => c.startsWith('hares_rt='))).toBe(true);

    expect((await t.call('GET', '/api/auth/me', { bearer: b.body.access_token })).body.code).toBe('TOKEN_REVOKED');
    expect((await t.call('GET', '/api/auth/me', { bearer: ok.body.access_token })).status).toBe(200);
  });

  // ---------- progressive login throttle ----------

  it('slows down after 5 failures, never locks out, and a success clears the counter', async () => {
    freshSource();
    const user = await fx.user('throttle', { departmentId: dept });
    for (let i = 0; i < 4; i++) expect((await login(user.email, 'Wrong#Pass1')).status).toBe(401);
    // 5th failure is still answered normally but starts the delay.
    expect((await login(user.email, 'Wrong#Pass1')).body.code).toBe('INVALID_CREDENTIALS');

    const keys = throttleKeys(user.email, sourceIp, 'web');
    // Pin the delay so a slow runner cannot outlive the first 2-second step.
    await fx.owner.query(`UPDATE "LoginAttempt" SET next_allowed_at = now() + interval '1 minute' WHERE key = $1`, [
      keys.account,
    ]);
    const blocked = await login(user.email);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // The extension login is throttled independently.
    expect((await login(user.email, TEST_PASSWORD, '/api/extension/login')).status).toBe(200);

    // Time passes (simulated): the delay has elapsed, the right password works.
    await fx.owner.query(`UPDATE "LoginAttempt" SET next_allowed_at = now() - interval '1 second' WHERE key = ANY($1)`, [
      [keys.account, keys.source],
    ]);
    expect((await login(user.email)).status).toBe(200);

    // Counter cleared for the account: 4 more failures cost nothing. (The
    // per-source counter is deliberately not cleared by a success, so use a
    // new address to look at the account counter alone.)
    freshSource();
    for (let i = 0; i < 4; i++) expect((await login(user.email, 'Wrong#Pass1')).status).toBe(401);
    const { rows } = await fx.owner.query(
      `SELECT failure_count, next_allowed_at FROM "LoginAttempt" WHERE key = $1 AND key_type = 'ACCOUNT'`,
      [keys.account],
    );
    expect(rows[0].failure_count).toBe(4);
    expect(rows[0].next_allowed_at).toBeNull();
    void keys;
  });

  it('counts attempts up front: a parallel burst of guesses cannot pass the gate', async () => {
    freshSource();
    const user = await fx.user('throttle-burst', { departmentId: dept });
    const results = await Promise.all(
      Array.from({ length: 12 }, () => login(user.email, 'Wrong#Pass1')),
    );
    // At most 5 attempts reach the password check (4 free + the 5th that starts the delay).
    expect(results.filter((r) => r.status === 401).length).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(7);
  });

  it('doubles the stored delay on each further failure, using the database clock', async () => {
    freshSource();
    const user = await fx.user('throttle-double', { departmentId: dept });
    const keys = throttleKeys(user.email, sourceIp, 'web');
    const delay = async () =>
      (
        await fx.owner.query(
          `SELECT ceil(extract(epoch FROM next_allowed_at - now()))::int AS d FROM "LoginAttempt" WHERE key = $1 AND key_type = 'ACCOUNT'`,
          [keys.account],
        )
      ).rows[0]?.d as number | null;
    const expire = () =>
      fx.owner.query(`UPDATE "LoginAttempt" SET next_allowed_at = now() - interval '1 second' WHERE key = $1`, [
        keys.account,
      ]);

    for (let i = 0; i < 4; i++) await login(user.email, 'Wrong#Pass1');
    expect(await delay()).toBeNull();
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      await login(user.email, 'Wrong#Pass1');
      seen.push((await delay()) ?? 0);
      await expire();
    }
    expect(seen).toEqual([2, 4, 8]);
  });

  it('throttles wrong current passwords on change-password', async () => {
    freshSource();
    const user = await fx.user('change-throttle', { departmentId: dept });
    const session = await login(user.email);
    const attempt = () =>
      t.call('POST', '/api/auth/change-password', {
        bearer: session.body.access_token,
        body: { current_password: 'Wrong#Pass9', new_password: NEW_PASSWORD },
      });
    for (let i = 0; i < 5; i++) expect((await attempt()).body.code).toBe('INVALID_CURRENT_PASSWORD');
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });

  it('throttles the extension login too and ends extension sessions on change-password', async () => {
    freshSource();
    const user = await fx.user('ext-throttle', { departmentId: dept });
    const ext = await login(user.email, TEST_PASSWORD, '/api/extension/login');
    const web = await login(user.email);
    await t.call('POST', '/api/auth/change-password', {
      bearer: web.body.access_token,
      body: { current_password: TEST_PASSWORD, new_password: NEW_PASSWORD },
    });
    const refreshed = await t.call('POST', '/api/extension/refresh', { body: { refresh_token: ext.body.refresh_token } });
    expect(refreshed.body.code).toBe('TOKEN_REVOKED');

    for (let i = 0; i < 5; i++) await login(user.email, 'Wrong#Pass1', '/api/extension/login');
    const blocked = await login(user.email, NEW_PASSWORD, '/api/extension/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });

  it('a change-password invalidates reset links issued before it', async () => {
    freshSource();
    const user = await fx.user('change-reset', { departmentId: dept });
    await forgot(user.email);
    await idle();
    const token = tokenFromMail(outbox[0]);
    const web = await login(user.email);
    await t.call('POST', '/api/auth/change-password', {
      bearer: web.body.access_token,
      body: { current_password: TEST_PASSWORD, new_password: NEW_PASSWORD },
    });
    const res = await t.call('POST', '/api/auth/reset-password', { body: { token, new_password: 'Third#Pass3' } });
    expect(res.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('throttles unknown emails exactly like real ones (no enumeration)', async () => {
    freshSource();
    const nobody = fx.email('throttle-nobody');
    fx.emails.push(nobody);
    for (let i = 0; i < 5; i++) await login(nobody, 'Wrong#Pass1');
    const res = await login(nobody, 'Wrong#Pass1');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });

  it('a password reset clears the account throttle', async () => {
    freshSource();
    const user = await fx.user('throttle-reset', { departmentId: dept });
    for (let i = 0; i < 6; i++) await login(user.email, 'Wrong#Pass1');
    expect((await login(user.email)).status).toBe(429);

    // Simulate a different source address by clearing source counters only.
    await fx.owner.query(`DELETE FROM "LoginAttempt" WHERE key = $1 AND key_type = 'SOURCE'`, [
      throttleKeys(user.email, sourceIp, 'web').source,
    ]);
    await forgot(user.email);
    await idle();
    const token = tokenFromMail(outbox[0]);
    await t.call('POST', '/api/auth/reset-password', { body: { token, new_password: NEW_PASSWORD } });
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
  });
});
