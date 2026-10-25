import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from '../request-context';

const MAX_REQUEST_ID_LENGTH = 128;

/**
 * Resolve the correlation id for a request.
 *
 * The client may send an `x-request-id` header (used to correlate a client
 * request across the stack); otherwise a UUID is generated. The value is
 * truncated to `CorrelationIdSchema`'s 128-char upper bound so a hostile or
 * over-long header cannot be reflected into logs or responses.
 */
export function resolveRequestId(req: Request): string {
  const header = req.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  const trimmed = candidate?.trim();
  const id = trimmed && trimmed.length > 0 ? trimmed : randomUUID();
  return id.length > MAX_REQUEST_ID_LENGTH ? id.slice(0, MAX_REQUEST_ID_LENGTH) : id;
}

/**
 * Middleware that assigns and propagates the `request_id` for every request:
 *  - echoes it back on the `x-request-id` response header,
 *  - binds it to the async context for interceptors and filters.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = resolveRequestId(req);
    res.setHeader('x-request-id', requestId);
    runWithRequestContext(requestId, () => next());
  }
}
