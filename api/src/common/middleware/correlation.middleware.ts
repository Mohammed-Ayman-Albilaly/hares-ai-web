import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from '../request-context';

/**
 * Allowed shape of a client-supplied correlation id: 1-128 chars from
 * `[A-Za-z0-9._-]`. Anything else (an invalid or over-long header, or no
 * header at all) is replaced with a generated UUID so a hostile value can
 * never be reflected into logs or responses.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Resolve the correlation id for a request.
 *
 * The client may send an `x-request-id` header (used to correlate a client
 * request across the stack); otherwise a UUID is generated. The header is
 * validated against `REQUEST_ID_PATTERN`.
 */
export function resolveRequestId(req: Request): string {
  const header = req.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  const trimmed = candidate?.trim();
  return trimmed && REQUEST_ID_PATTERN.test(trimmed) ? trimmed : randomUUID();
}

/**
 * Middleware that assigns and propagates the `request_id` for every request:
 *  - echoes it back on the `x-request-id` response header,
 *  - binds it to the async context for interceptors and filters.
 *
 * Registered as the first middleware in `main.ts` so a malformed body still
 * gets a `request_id` and the `x-request-id` response header.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = resolveRequestId(req);
    res.setHeader('x-request-id', requestId);
    runWithRequestContext(requestId, () => next());
  }
}
