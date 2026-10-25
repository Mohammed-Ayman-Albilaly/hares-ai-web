import { z } from 'zod';

/**
 * Correlation / request-context types (ARCHITECTURE.md §4, DECISIONS #2).
 *
 * Every request gets a `request_id` (a correlation id) that propagates to the
 * request logs and to the error envelope. It is taken from the `x-request-id`
 * request header when the client sends one, otherwise generated as a UUID.
 */
export const CorrelationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .describe('Per-request correlation id (from x-request-id or a generated UUID).');

export type CorrelationId = z.infer<typeof CorrelationIdSchema>;

/** The per-request context captured for logging and error correlation. */
export const RequestContextSchema = z.object({
  request_id: CorrelationIdSchema,
});

export type RequestContext = z.infer<typeof RequestContextSchema>;
