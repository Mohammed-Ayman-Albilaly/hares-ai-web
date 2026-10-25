import { z } from 'zod';
import { CorrelationIdSchema } from './request-context';

/**
 * Liveness/readiness response for `GET /health` (batch B3).
 *
 * `uptime` is seconds the API process has been up; `timestamp` is the ISO-8601
 * UTC time of the check; `request_id` correlates the probe to the request logs.
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  uptime: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  request_id: CorrelationIdSchema,
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
