import { z } from 'zod';

/**
 * Consistent API error envelope (ARCHITECTURE.md §4).
 * All JSON fields are snake_case.
 *
 *   { status, code, message, details?, path, timestamp, request_id }
 * `code` is a machine-readable, localized key; `message` is a safe human
 * fallback; `details` carries field-level validation errors.
 */
export const ApiErrorEnvelopeSchema = z.object({
  // HTTP status of the error (400/401/403/404/409/429 for this API).
  status: z.number().int(),
  // Machine-readable, localized key (client maps to Arabic/English via i18next).
  // Kept as a free string for the generic envelope; extension endpoints narrow it
  // via ExtensionErrorEnvelopeSchema (./errors).
  code: z.string(),
  // Safe human-readable fallback message.
  message: z.string(),
  // Field-level validation errors: field name -> list of message strings.
  details: z.record(z.string(), z.array(z.string())).optional(),
  // Request path of the failing call.
  path: z.string(),
  // ISO-8601 UTC timestamp.
  timestamp: z.string().datetime(),
  // Correlation ID propagated to request logs.
  request_id: z.string(),
});

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
