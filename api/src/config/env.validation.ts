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
 *  - `DATABASE_URL` is mandatory and must be a PostgreSQL connection string.
 *    It is used by the Prisma CLI and the seed script.
 *  - `APP_DATABASE_URL` is mandatory (except under `test`) and must be a
 *    PostgreSQL connection string for the `hares_app` application role. The
 *    runtime Prisma client connects with it.
 *  - `PORT` defaults to 3000.
 *  - `CORS_ORIGIN` is a comma-separated allowlist of origins.
 *  - `JWT_ACCESS_SECRET` signs the access JWTs (HS256). It is mandatory
 *    (except under `test`, where the auth module uses a random per-process
 *    secret) and must be at least 32 characters.
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
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required')
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        'DATABASE_URL must be a postgres:// (or postgresql://) connection string',
      ),
    APP_DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        'APP_DATABASE_URL must be a postgres:// connection string',
      )
      .optional(),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:1420'),
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
    if (val.NODE_ENV !== 'test' && !val.APP_DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_DATABASE_URL'],
        message: 'APP_DATABASE_URL is required when NODE_ENV is not test',
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
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${issues}`);
  }
  // `.default()` fills in the defaults, so the returned object is complete.
  return result.data as Record<string, unknown>;
}
