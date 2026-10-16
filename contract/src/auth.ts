import { z } from 'zod';

/**
 * Extension authentication contract (ARCHITECTURE.md §7(b), plus decisions):
 *   POST /extension/login  (email, password)          -> 200 { accessToken, refreshToken, expiresIn }
 *   POST /extension/refresh (refreshToken)            -> 200 { accessToken, refreshToken (rotated), expiresIn }
 *   POST /extension/logout (refreshToken)             -> 204 No Content          [NEW — not in SPEC]
 *   Access token TTL <= 1h; refresh token rotating, ~30-day, in extension storage.
 *
 * NOTE: written against the Zod v3 API (`z.string().email()`, `z.enum`).
 * Zod v4 moves `.email()`/`.datetime()` to top-level helpers — see the
 * "Zod v4" note in this module's docs.
 */
export const ExtensionTokenSchema = z.string().min(1);

export const ExtensionLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type ExtensionLoginRequest = z.infer<typeof ExtensionLoginRequestSchema>;

/** Shared auth response shape: access token + rotating refresh token + access TTL (seconds). */
export const ExtensionAuthResponseSchema = z.object({
  accessToken: ExtensionTokenSchema,
  refreshToken: ExtensionTokenSchema,
  /** Access-token TTL in seconds (positive integer). */
  expiresIn: z.number().int().positive(),
});
export type ExtensionAuthResponse = z.infer<typeof ExtensionAuthResponseSchema>;

export const ExtensionLoginResponseSchema = ExtensionAuthResponseSchema;
export type ExtensionLoginResponse = z.infer<typeof ExtensionLoginResponseSchema>;

export const ExtensionRefreshRequestSchema = z.object({
  refreshToken: ExtensionTokenSchema,
});
export type ExtensionRefreshRequest = z.infer<typeof ExtensionRefreshRequestSchema>;

export const ExtensionRefreshResponseSchema = ExtensionAuthResponseSchema;
export type ExtensionRefreshResponse = z.infer<typeof ExtensionRefreshResponseSchema>;

/**
 * POST /extension/logout — revokes the presented refresh token's whole family.
 * Returns 204 No Content (no response body). [NEW]
 */
export const ExtensionLogoutRequestSchema = z.object({
  refreshToken: ExtensionTokenSchema,
});
export type ExtensionLogoutRequest = z.infer<typeof ExtensionLogoutRequestSchema>;

/** 204 No Content — no JSON body is returned. */
export const EXTENSION_LOGOUT_STATUS_CODE = 204;
