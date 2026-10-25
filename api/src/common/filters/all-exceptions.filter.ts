import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { getRequestContext } from '../request-context';

const INTERNAL_MESSAGE = 'An unexpected error occurred.';

/**
 * Machine-readable code for exceptions that carry no `code` of their own.
 * The values are members of the contract's ERROR_CODES, so the extension can
 * parse every error (e.g. a malformed JSON body is VALIDATION_ERROR).
 */
const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'INVALID_TOKEN',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Safe human fallback message for exceptions that carry no safe message. */
const STATUS_MESSAGE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Request payload too large',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
};

/** Map an HTTP status to a machine-readable code. */
function codeForStatus(status: number): string {
  if (status >= 500) return 'INTERNAL_ERROR';
  return STATUS_CODE_MAP[status] ?? 'INTERNAL_ERROR';
}

/** Map an HTTP status to a safe human catalog message. */
function safeMessageForStatus(status: number): string {
  if (status >= 500) return INTERNAL_MESSAGE;
  return STATUS_MESSAGE[status] ?? INTERNAL_MESSAGE;
}

/**
 * Read a numeric HTTP status off a third-party http error (body-parser,
 * http-errors) so a malformed body still becomes the matching client status
 * without forwarding its message.
 */
function httpErrorStatus(exception: unknown): number | undefined {
  if (!exception || typeof exception !== 'object') return undefined;
  const rec = exception as Record<string, unknown>;
  const raw = rec.statusCode ?? rec.status;
  return typeof raw === 'number' &&
    Number.isInteger(raw) &&
    raw >= 400 &&
    raw < 600
    ? raw
    : undefined;
}

/** True when the exception is one of our own and carries a trusted `code`. */
function hasOwnCode(exception: HttpException): boolean {
  const res = exception.getResponse();
  return (
    typeof res === 'object' &&
    res !== null &&
    typeof (res as Record<string, unknown>).code === 'string'
  );
}

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
 * Exceptions our own code creates carry a `code`; every other exception (Nest
 * built-ins, body-parser / http-errors, unknown errors) is mapped to a fixed
 * code and a fixed safe message per status, so no third-party message such as a
 * JSON parser error is ever echoed back. `details` only ever carries code-only,
 * field-level messages — never the received value (DECISIONS #2). Unknown
 * exceptions become 500 with a generic message (no stack/leak), and unexpected
 * (5xx) errors are logged server-side with message + stack, no request data.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : httpErrorStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR;

    let code: string;
    let message: string;
    let details: Record<string, string[]> | undefined;

    if (isHttp && hasOwnCode(exception)) {
      const res = exception.getResponse();
      const body =
        typeof res === 'object' && res !== null
          ? (res as Record<string, unknown>)
          : {};
      code = typeof body.code === 'string' ? body.code : 'INTERNAL_ERROR';
      message =
        typeof body.message === 'string' ? body.message : INTERNAL_MESSAGE;
      details = sanitizeDetails(body.details);
    } else {
      code = codeForStatus(status);
      message = safeMessageForStatus(status);
    }

    if (status >= 500) {
      const err =
        exception instanceof Error
          ? exception
          : new Error(typeof exception === 'string' ? exception : 'Unknown error');
      this.logger.error(err.message, err.stack);
    }

    const requestId =
      getRequestContext()?.request_id ??
      (Array.isArray(request.headers['x-request-id'])
        ? request.headers['x-request-id'][0]
        : request.headers['x-request-id']) ??
      'unknown';

    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];

    const envelope = {
      status,
      code,
      message,
      ...(details ? { details } : {}),
      path,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    };

    response.status(status).json(envelope);
  }
}
