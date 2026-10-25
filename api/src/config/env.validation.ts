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
 *  - `PORT` defaults to 3000.
 *  - `CORS_ORIGIN` is a comma-separated allowlist of origins.
 *
 * The admin bootstrap values (`INITIAL_ADMIN_*`) are validated for shape when
 * present; the seed script enforces the password policy itself.
 */
export const envSchema = z.object({
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
  INITIAL_ADMIN_NAME: z.string().min(1).optional(),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(1).optional(),
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
