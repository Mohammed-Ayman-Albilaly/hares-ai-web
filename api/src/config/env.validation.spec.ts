import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://hares:hares@localhost:5432/hares';
const APP_DATABASE_URL = 'postgresql://hares_app:pw@localhost:5432/hares';

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
