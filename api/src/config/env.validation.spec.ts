import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://hares:hares@localhost:5432/hares';
const APP_DATABASE_URL = 'postgresql://hares_app:pw@localhost:5432/hares';
const JWT_ACCESS_SECRET = 'synthetic-test-secret-0123456789abcdef';

describe('env.validation → APP_DATABASE_URL', () => {
  it('requires APP_DATABASE_URL when NODE_ENV is not test', () => {
    expect(() =>
      validateEnv({ DATABASE_URL, NODE_ENV: 'development' }),
    ).toThrow(/APP_DATABASE_URL/);
  });

  it('defaults NODE_ENV to development and therefore requires APP_DATABASE_URL', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/APP_DATABASE_URL/);
  });

  it('allows a missing APP_DATABASE_URL only when NODE_ENV is test', () => {
    const config = validateEnv({ DATABASE_URL, NODE_ENV: 'test' });
    expect(config.NODE_ENV).toBe('test');
    expect(config.APP_DATABASE_URL).toBeUndefined();
  });

  it('accepts a valid APP_DATABASE_URL in development', () => {
    const config = validateEnv({
      DATABASE_URL,
      NODE_ENV: 'development',
      APP_DATABASE_URL,
      JWT_ACCESS_SECRET,
    });
    expect(config.APP_DATABASE_URL).toBe(APP_DATABASE_URL);
  });

  it('rejects an APP_DATABASE_URL that is not a postgres connection string', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL,
        NODE_ENV: 'development',
        APP_DATABASE_URL: 'mysql://user:pw@localhost:3306/hares',
      }),
    ).toThrow(/APP_DATABASE_URL/);
  });
});

describe('env.validation → JWT_ACCESS_SECRET', () => {
  it('requires JWT_ACCESS_SECRET when NODE_ENV is not test', () => {
    expect(() =>
      validateEnv({ DATABASE_URL, APP_DATABASE_URL, NODE_ENV: 'development' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a secret shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL,
        APP_DATABASE_URL,
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('allows a missing secret only when NODE_ENV is test', () => {
    const config = validateEnv({ DATABASE_URL, NODE_ENV: 'test' });
    expect(config.JWT_ACCESS_SECRET).toBeUndefined();
  });
});

describe('env.validation → production hardening', () => {
  const production = {
    NODE_ENV: 'production',
    APP_DATABASE_URL,
    JWT_ACCESS_SECRET,
    TRUST_PROXY: '1',
    WEB_BASE_URL: 'https://hares.example.org',
    SMTP_HOST: 'smtp.example.org',
  };

  it('does not need the owner DATABASE_URL: the API container runs with the application role only', () => {
    expect(() => validateEnv({ ...production })).not.toThrow();
  });

  it('still needs DATABASE_URL outside production (Prisma CLI, seed)', () => {
    expect(() => validateEnv({ NODE_ENV: 'development', APP_DATABASE_URL, JWT_ACCESS_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('refuses the placeholder secrets of the example file in production', () => {
    expect(() => validateEnv({ ...production, JWT_ACCESS_SECRET: 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_OF_AT_LEAST_32_CHARS' })).toThrow(/placeholder/);
    expect(() => validateEnv({ ...production, APP_DATABASE_URL: 'postgresql://hares_app:A_LONG_RANDOM_PASSWORD@db:5432/hares' })).toThrow(/placeholder/);
  });

  it('treats an empty value as not set: a blank secret is "missing", a blank optional setting is ignored', () => {
    expect(() => validateEnv({ ...production, JWT_ACCESS_SECRET: '' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ ...production, SMTP_USER: '', SMTP_PASS: '' })).not.toThrow();
  });
});
