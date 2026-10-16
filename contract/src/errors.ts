import { z } from 'zod';
import { ApiErrorEnvelopeSchema } from './error';

/**
 * Machine-readable `code` values used by the extension-facing endpoints.
 *
 * These are the values the extension should branch on (mapped to Arabic/English
 * via i18next). The shared `ApiErrorEnvelopeSchema.code` is intentionally kept as
 * a free `string` because the web endpoints use a broader set; the extension
 * endpoints emit one of the codes below.
 *
 * Source: ARCHITECTURE.md §7(b)/§7(c)/§4 (HTTP status + rejection conditions).
 */

export const ERROR_CODES = [
  // ---- 400 ----
  'VALIDATION_ERROR', // missing/invalid fields (login, refresh)
  'UNKNOWN_FIELD', // ingestion payload field not in the allowlist (WEB-FR-046)
  'INVALID_ENUM', // enum value not valid for the current schema_version (WEB-FR-049, WEB-NFR-021)
  'UNSUPPORTED_SCHEMA_VERSION', // schema_version not supported
  'EVENT_TIME_OUT_OF_RANGE', // event_time >5 min future or older than 90 days
  // ---- 401 ----
  'INVALID_CREDENTIALS', // login wrong email/password (WEB-FR-004)
  'ACCOUNT_INACTIVE', // login denied, account DEACTIVATED (WEB-FR-005)
  'ACCOUNT_NO_ACCESS', // login denied, account PENDING/REJECTED (WEB-FR-005)
  'INVALID_TOKEN', // missing/expired/malformed access or refresh token
  'TOKEN_EXPIRED', // access token expired; the extension refreshes on this
  'TOKEN_REVOKED', // token_version mismatch; token revoked (WEB-FR-059)
  'REFRESH_REUSED', // an already-used refresh token was replayed; family revoked (WEB-FR-068)
  // ---- 403 ----
  'USER_NOT_ACTIVE', // ingestion: user not ACTIVE
  'DEPARTMENT_INACTIVE', // ingestion: department deactivated (WEB-FR-056)
  'FORBIDDEN', // generic authorization denial for the extension scope
  // ---- 413 / 429 ----
  'PAYLOAD_TOO_LARGE', // ingestion payload exceeds the size cap
  'RATE_LIMITED', // per-user/per-source rate limit or login throttling (WEB-NFR-020)
  // ---- 500 / 503 ----
  'INTERNAL_ERROR', // unexpected server error
  'SERVICE_UNAVAILABLE', // service temporarily unavailable
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Extension-specific error envelope: narrows the generic envelope's `code`. */
export const ExtensionErrorEnvelopeSchema = ApiErrorEnvelopeSchema.extend({
  code: ErrorCodeSchema,
});
export type ExtensionErrorEnvelope = z.infer<typeof ExtensionErrorEnvelopeSchema>;
