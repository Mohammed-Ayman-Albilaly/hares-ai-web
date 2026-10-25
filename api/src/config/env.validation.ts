import { z } from 'zod';

/**
 * Environment schema for the API process.
 *
 * The values are read from `process.env` (and the `.env` file) by
 * `ConfigModule.forRoot`. We validate them at boot so a misconfigured
 * deployment fails fast with a clear message instead of crashing later with a
 * confusing runtime error.
 *
 * Validation rules (DECISIONS / ARCHITECTURE):
 *  - `DATABASE_URL` must be a PostgreSQL connection string. It is used by the
 *    Prisma CLI and the seed script, so it is required except in production,
 *    where the API container runs with the least-privilege `APP_DATABASE_URL` only.
 *  - `APP_DATABASE_URL` is mandatory (except under `test`) and must be a
 *    PostgreSQL connection string for the `hares_app` application role. The
 *    runtime Prisma client connects with it.
 *  - `PORT` defaults to 3000.
 *  - `CORS_ORIGIN` is a comma-separated allowlist of origins.
 *  - `JWT_ACCESS_SECRET` signs the access JWTs (HS256). It is mandatory
 *    (except under `test`, where the auth module uses a random per-process
 *    secret) and must be at least 32 characters.
 *  - SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
 *    `MAIL_FROM`) sends the reset email; it defaults to Mailpit on
 *    localhost:1025 and `SMTP_HOST` is required in production.
 *  - `WEB_BASE_URL` is the public web origin used in emailed links.
 *  - `TRUST_PROXY` is passed to Express `trust proxy` so `req.ip` is the real
 *    client address behind the reverse proxy (decision 27), e.g. `1`.
 *  - `RATE_LIMITS` (on/off) toggles the per-endpoint request windows; they are
 *    off by default under `test` only. The progressive login throttle is
 *    always on.
 *  - `JOBS` (on/off) toggles the scheduled reconcile and purge jobs; they are
 *    off by default under `test` only.
 *  - `COOKIE_SECURE` (true/false) overrides the refresh cookie's Secure flag;
 *    by default it is Secure only in production.
 *
 * The bootstrap admin values (`INITIAL_ADMIN_*`) are used only by the seed
 * script, which reads them from `process.env` directly, so they are not part
 * of this runtime schema.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    // The owner connection: migrations, grants and seed only. The production API container does not get it.
    DATABASE_URL: z
      .string()
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        'DATABASE_URL must be a postgres:// (or postgresql://) connection string',
      )
      .optional(),
    APP_DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        'APP_DATABASE_URL must be a postgres:// connection string',
      )
      .optional(),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:1420'),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().min(3).default('Hares AI <no-reply@hares.local>'),
    WEB_BASE_URL: z.string().url().default('http://localhost:1420'),
    // A hop count, or a comma list of IPs / CIDRs / loopback|linklocal|uniquelocal.
    // "true" (trust everyone) is refused: any client could then fake its IP.
    TRUST_PROXY: z
      .string()
      .regex(
        /^(\d+|((loopback|linklocal|uniquelocal|[0-9a-fA-F.:]+(\/\d{1,3})?)(\s*,\s*(loopback|linklocal|uniquelocal|[0-9a-fA-F.:]+(\/\d{1,3})?))*))$/,
        'TRUST_PROXY must be a hop count or a list of proxy addresses',
      )
      .optional(),
    RATE_LIMITS: z.enum(['on', 'off']).optional(),
    JOBS: z.enum(['on', 'off']).optional(),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production' && !val.DATABASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'DATABASE_URL is required outside production' });
    }
    // The example file ships obvious placeholders: running with one would mean a publicly known secret.
    const placeholder = /CHANGE_?ME|A_LONG_RANDOM|PLACEHOLDER/i;
    if (val.NODE_ENV === 'production') {
      if (val.JWT_ACCESS_SECRET && placeholder.test(val.JWT_ACCESS_SECRET)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_ACCESS_SECRET'], message: 'JWT_ACCESS_SECRET still has the example placeholder: generate a random secret' });
      }
      if (val.APP_DATABASE_URL && placeholder.test(val.APP_DATABASE_URL)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['APP_DATABASE_URL'], message: 'APP_DATABASE_URL still has the example placeholder password' });
      }
    }
    if (val.NODE_ENV !== 'test' && !val.APP_DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_DATABASE_URL'],
        message: 'APP_DATABASE_URL is required when NODE_ENV is not test',
      });
    }
    if (val.NODE_ENV === 'production' && !val.TRUST_PROXY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message: 'TRUST_PROXY is required in production (the API runs behind the reverse proxy)',
      });
    }
    if (val.NODE_ENV === 'production' && !val.WEB_BASE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEB_BASE_URL'],
        message: 'WEB_BASE_URL must use https in production',
      });
    }
    if (val.NODE_ENV === 'production' && !val.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required in production',
      });
    }
    if (val.NODE_ENV !== 'test' && !val.JWT_ACCESS_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET is required when NODE_ENV is not test',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validate a raw config object (as produced by `ConfigModule` from
 * `process.env`) against `envSchema`.
 *
 * Throws a readable error listing every invalid field so a broken deployment
 * fails fast at boot rather than producing confusing runtime failures.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  // An empty value means "not set" (a compose file or a .env line with nothing after the =).
  const present = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${issues}`);
  }
  // `.default()` fills in the defaults, so the returned object is complete.
  return result.data as Record<string, unknown>;
}
