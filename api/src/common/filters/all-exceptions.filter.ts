import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestContext } from '../request-context';

const INTERNAL_MESSAGE = 'An unexpected error occurred.';

/** Coerce `details` into a map of field -> array of plain-string messages. */
function sanitizeDetails(
  details: unknown,
): Record<string, string[]> | undefined {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(details)) {
    const list = Array.isArray(value) ? value : [value];
    out[key] = list.map((v) => String(v));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Global exception filter that renders every HTTP error as the consistent API
 * error envelope (ARCHITECTURE §4):
 *
 *   { status, code, message, details?, path, timestamp, request_id }
 *
 * `code` is a machine-readable key and `message` is a safe human fallback.
 * `details` only ever carries code-only, field-level messages — never the
 * received value, so nothing prompt-like is reflected back (DECISIONS #2).
 * Unknown exceptions become 500 with a generic message (no stack/leak).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let code = 'INTERNAL_ERROR';
    let message = INTERNAL_MESSAGE;
    let details: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const body = res as Record<string, unknown>;
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.message === 'string') message = body.message;
        details = sanitizeDetails(body.details);
      }
    }

    const requestId =
      getRequestContext()?.request_id ??
      (Array.isArray(request.headers['x-request-id'])
        ? request.headers['x-request-id'][0]
        : request.headers['x-request-id']) ??
      'unknown';

    const envelope = {
      status,
      code,
      message,
      ...(details ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    };

    response.status(status).json(envelope);
  }
}
