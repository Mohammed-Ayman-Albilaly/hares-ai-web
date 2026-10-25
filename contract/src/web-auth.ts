import { z } from 'zod';
import { RoleSchema, UserStatusSchema } from './enums';

/**
 * Web authentication contract (batch B4a).
 * All JSON fields are snake_case.
 *
 *   POST /auth/register  (full_name, email, password) -> 201 { status: PENDING }
 *   POST /auth/login     (email, password)            -> 200 TokenPair + user, sets the refresh cookie
 *   POST /auth/refresh   (no body, refresh cookie)    -> 200 TokenPair + user, rotates the refresh cookie
 *   POST /auth/logout    (no body, refresh cookie)    -> 204, revokes the family and clears the cookie
 *   GET  /auth/me        (bearer access token)        -> 200 UserPublic
 *
 * The web refresh token never appears in a JSON body: it lives only in an
 * HTTP-only cookie (ARCHITECTURE §2, decision 12).
 */

/** bcrypt only reads the first 72 bytes, so longer passwords are rejected (decision 32). */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Password policy (decision 22): at least 8 characters with an uppercase
 * letter, a lowercase letter, a digit and a symbol, and at most 72 bytes.
 * Messages are stable keys that the web client localizes; they never echo the value.
 */
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'password.too_short')
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_BYTES, 'password.too_long')
  .refine((v) => /[A-Z]/.test(v), 'password.needs_uppercase')
  .refine((v) => /[a-z]/.test(v), 'password.needs_lowercase')
  .refine((v) => /[0-9]/.test(v), 'password.needs_digit')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'password.needs_symbol');

/** Emails are compared case-insensitively (unique index on lower(email)). */
export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const FullNameSchema = z.string().trim().min(1).max(120);

export const RegisterRequestSchema = z
  .object({
    full_name: FullNameSchema,
    email: EmailSchema,
    password: PasswordSchema,
  })
  .strict();
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** A new account is always PENDING: no role, no department, no access (decision 3). */
export const RegisterResponseSchema = z.object({
  status: z.literal('PENDING'),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

/**
 * Login only checks that both fields are present. The password policy is not
 * applied here so a policy change never locks out an existing account.
 */
export const LoginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1),
    password: z.string().min(1),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Public view of an account. Never carries the password hash or token_version. */
export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string(),
  status: UserStatusSchema,
  role: RoleSchema.nullable(),
  department_id: z.string().uuid().nullable(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

/**
 * Web token response. The access token is kept in memory by the SPA; the
 * matching refresh token is only in the HTTP-only cookie.
 */
export const TokenPairSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('Bearer'),
  /** Access-token TTL in seconds. */
  expires_in: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const LoginResponseSchema = TokenPairSchema.extend({
  user: UserPublicSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** The refresh token comes from the cookie, so the body must be empty. */
export const RefreshRequestSchema = z.object({}).strict();
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = LoginResponseSchema;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const LogoutRequestSchema = z.object({}).strict();
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

export const MeResponseSchema = UserPublicSchema;
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** Name and path of the web refresh cookie (path-scoped to the auth routes). */
export const REFRESH_COOKIE_NAME = 'hares_rt';
export const REFRESH_COOKIE_PATH = '/api/auth';

/** Error codes emitted by the web auth endpoints (in addition to VALIDATION_ERROR). */
export const WEB_AUTH_ERROR_CODES = [
  'EMAIL_TAKEN', // 409 register: email already registered (decision 29 allows this)
  'INVALID_CREDENTIALS', // 401 login: wrong email or password (never says which)
  'ACCOUNT_PENDING', // 401 login: correct password, account still PENDING
  'ACCOUNT_REJECTED', // 401 login: correct password, account REJECTED
  'ACCOUNT_INACTIVE', // 401 login/guard: account DEACTIVATED
  'INVALID_TOKEN', // 401 missing/malformed/unknown token or refresh cookie
  'TOKEN_EXPIRED', // 401 access token expired; the SPA calls /auth/refresh
  'TOKEN_REVOKED', // 401 token_version mismatch or revoked family
  'REFRESH_REUSED', // 401 a used refresh token was replayed; family revoked
  'ORIGIN_NOT_ALLOWED', // 403 cookie request from a foreign Origin (CSRF guard)
] as const;
export const WebAuthErrorCodeSchema = z.enum(WEB_AUTH_ERROR_CODES);
export type WebAuthErrorCode = z.infer<typeof WebAuthErrorCodeSchema>;
