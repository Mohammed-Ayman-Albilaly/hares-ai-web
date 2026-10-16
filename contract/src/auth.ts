import { z } from 'zod';

/**
 * Extension authentication contract (ARCHITECTURE.md §7(b), plus decisions).
 * All JSON fields are snake_case.
 *
 *   POST /extension/login  (email, password)          -> 200 { access_token, refresh_token, expires_in }
 *   POST /extension/refresh (refresh_token)           -> 200 { access_token, refresh_token (rotated), expires_in }
 *   POST /extension/logout (refresh_token)            -> 204 No Content          [NEW — not in SPEC]
 *   Access token TTL <= 1h; refresh token rotating, ~30-day, in extension storage.
 */
export const ExtensionTokenSchema = z.string().min(1);

export const ExtensionLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type ExtensionLoginRequest = z.infer<typeof ExtensionLoginRequestSchema>;

/** Shared auth response shape: access token + rotating refresh token + access TTL (seconds). */
export const ExtensionAuthResponseSchema = z.object({
  access_token: ExtensionTokenSchema,
  refresh_token: ExtensionTokenSchema,
  /** Access-token TTL in seconds (positive integer). */
  expires_in: z.number().int().positive(),
});
export type ExtensionAuthResponse = z.infer<typeof ExtensionAuthResponseSchema>;

export const ExtensionLoginResponseSchema = ExtensionAuthResponseSchema;
export type ExtensionLoginResponse = z.infer<typeof ExtensionLoginResponseSchema>;

export const ExtensionRefreshRequestSchema = z.object({
  refresh_token: ExtensionTokenSchema,
});
export type ExtensionRefreshRequest = z.infer<typeof ExtensionRefreshRequestSchema>;

export const ExtensionRefreshResponseSchema = ExtensionAuthResponseSchema;
export type ExtensionRefreshResponse = z.infer<typeof ExtensionRefreshResponseSchema>;

/**
 * POST /extension/logout — revokes the presented refresh token's whole family.
 * Returns 204 No Content (no response body). [NEW]
 */
export const ExtensionLogoutRequestSchema = z.object({
  refresh_token: ExtensionTokenSchema,
});
export type ExtensionLogoutRequest = z.infer<typeof ExtensionLogoutRequestSchema>;

/** 204 No Content — no JSON body is returned. */
export const EXTENSION_LOGOUT_STATUS_CODE = 204;
