import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Turn the per-endpoint request windows on for this file only (they are off by
// default under NODE_ENV=test). Must run before AppModule is imported.
vi.hoisted(() => {
  process.env.RATE_LIMITS = 'on';
});

import { MailerService } from '../mail/mailer.service';
import { bootTestApp, dbEnabled, Fixtures, type TestApp } from '../test/http-test-app';
import { PasswordResetService } from './password/password-reset.service';

if (!dbEnabled) console.warn('[rate-limits] database not configured — skipping.');

describe.skipIf(!dbEnabled)('per-endpoint request windows (@nestjs/throttler)', () => {
  let t: TestApp;
  let fx: Fixtures;

  beforeAll(async () => {
    fx = new Fixtures();
    t = await bootTestApp({
      override: (b) => b.overrideProvider(MailerService).useValue({ send: async () => {} }),
    });
  }, 60_000);

  afterAll(async () => {
    await t?.app.get(PasswordResetService).whenIdle();
    await t?.close();
    await fx?.cleanup(undefined, t?.ip);
  });

  it('allows 5 forgot-password requests per 15 minutes per address, then 429 with Retry-After', async () => {
    const email = fx.email('window');
    for (let i = 0; i < 5; i++) {
      expect((await t.call('POST', '/api/auth/forgot-password', { body: { email } })).status).toBe(202);
    }
    const sixth = await t.call('POST', '/api/auth/forgot-password', { body: { email } });
    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe('RATE_LIMITED');
    expect(sixth.headers['retry-after']).toBeDefined();
  });
});
