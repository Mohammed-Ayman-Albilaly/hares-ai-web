import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';
import {
  LoginRequestSchema,
  PasswordSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
} from './web-auth';

describe('web auth schemas (B4a)', () => {
  it('accepts a password that meets the policy', () => {
    expect(PasswordSchema.safeParse('Synthetic#Pass1').success).toBe(true);
  });

  it.each([
    ['Ab1#', 'password.too_short'],
    ['abcdefg1#', 'password.needs_uppercase'],
    ['ABCDEFG1#', 'password.needs_lowercase'],
    ['Abcdefgh#', 'password.needs_digit'],
    ['Abcdefgh1', 'password.needs_symbol'],
    ['Aa1#' + 'x'.repeat(69), 'password.too_long'],
  ])('rejects %j with %s and never echoes the value', (pw, key) => {
    const r = PasswordSchema.safeParse(pw);
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toContain(key);
    expect(messages.join(' ')).not.toContain(pw);
  });

  it('counts the 72-byte limit in UTF-8 bytes, not characters', () => {
    // 'ش' is 2 bytes: 4 ASCII + 35 * 2 = 74 bytes but only 39 characters.
    expect(PasswordSchema.safeParse('Aa1#' + 'ش'.repeat(35)).success).toBe(false);
  });

  it('normalizes the email and rejects unknown fields on register', () => {
    const ok = RegisterRequestSchema.parse({
      full_name: ' Test User ',
      email: ' Someone@Example.TEST ',
      password: 'Synthetic#Pass1',
    });
    expect(ok.email).toBe('someone@example.test');
    expect(ok.full_name).toBe('Test User');
    expect(
      RegisterRequestSchema.safeParse({ ...ok, password: 'Synthetic#Pass1', role: 'SYSTEM_ADMIN' }).success,
    ).toBe(false);
  });

  it('login requires both fields but not the password policy', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@b.test', password: 'x' }).success).toBe(true);
    expect(LoginRequestSchema.safeParse({ email: '', password: 'x' }).success).toBe(false);
    expect(LoginRequestSchema.safeParse({ email: 'a@b.test' }).success).toBe(false);
  });

  it('refresh takes no body fields (the token is in the cookie)', () => {
    expect(RefreshRequestSchema.safeParse({}).success).toBe(true);
    expect(RefreshRequestSchema.safeParse({ refresh_token: 'x' }).success).toBe(false);
  });

  it('documents the web auth paths and the refresh cookie scheme', () => {
    const doc = buildOpenApiDocument();
    for (const p of ['/auth/register', '/auth/login', '/auth/refresh', '/auth/logout']) {
      expect(doc.paths?.[p]?.post).toBeDefined();
    }
    expect(doc.paths?.['/auth/me']?.get).toBeDefined();
    expect(doc.components?.securitySchemes?.refreshCookie).toMatchObject({ in: 'cookie' });
    expect(doc.components?.schemas?.['UserPublic']).toBeDefined();
    expect(doc.components?.schemas?.['TokenPair']).toBeDefined();
  });
});
