import { z } from 'zod';
import { EmailSchema, PasswordSchema } from './web-auth';

/**
 * Password recovery and change (batch B4c). All JSON fields are snake_case.
 *
 *   POST /auth/forgot-password  (email)                           -> 202 { status: 'accepted' }
 *   POST /auth/reset-password   (token, new_password)             -> 204
 *   POST /auth/change-password  (current_password, new_password)  -> 200 LoginResponse (new session)
 *
 * forgot-password answers the same way whether or not the email exists
 * (decision 29). The emailed link carries the token in the URL fragment
 * (`/reset-password#token=...`), so it never reaches server logs or Referer.
 */

/** A reset token is 32 random bytes in base64url (43 characters). */
export const ResetTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'reset.token_invalid');

export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema }).strict();
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ForgotPasswordResponseSchema = z.object({ status: z.literal('accepted') });
export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;

export const ResetPasswordRequestSchema = z
  .object({
    token: ResetTokenSchema,
    new_password: PasswordSchema,
  })
  .strict();
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/** 204 No Content — no JSON body. */
export const RESET_PASSWORD_STATUS_CODE = 204;

export const ChangePasswordRequestSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: PasswordSchema,
  })
  .strict();
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

/** Throttle configuration exposed for documentation and the web client. */
export const ThrottleConfigSchema = z.object({
  free_failures: z.number().int().nonnegative(),
  window_seconds: z.number().int().positive(),
  max_delay_seconds: z.number().int().positive(),
});
export type ThrottleConfig = z.infer<typeof ThrottleConfigSchema>;

export const PASSWORD_ERROR_CODES = [
  'RESET_TOKEN_INVALID', // 400 unknown, used or expired reset token (one code for all)
  'INVALID_CURRENT_PASSWORD', // 400 change-password: current password is wrong
  'RATE_LIMITED', // 429 login throttle or request window; Retry-After header is set
] as const;
export const PasswordErrorCodeSchema = z.enum(PASSWORD_ERROR_CODES);
export type PasswordErrorCode = z.infer<typeof PasswordErrorCodeSchema>;
