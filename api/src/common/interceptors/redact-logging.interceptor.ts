import {
  HttpException,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { getRequestContext } from '../request-context';

/**
 * Map a thrown error to an HTTP status, mirroring the global exception filter:
 *  - `HttpException` carry their own status;
 *  - third-party http errors (body-parser, http-errors) carry `status` /
 *    `statusCode`;
 *  - anything else is an unexpected server error (500).
 */
function errorStatus(err: unknown): number | undefined {
  if (err instanceof HttpException) {
    return err.getStatus();
  }
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const raw = rec.status ?? rec.statusCode;
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 400 && raw < 600) {
      return raw;
    }
  }
  return undefined;
}

/**
 * Logs each request and its response with the correlated `request_id`.
 *
 * Only operational metadata is logged: request_id, method, path (without the
 * query string), response status and duration. Both successful and failed
 * requests are logged (the failure branch fires when the handler observable
 * errors), but request and response bodies are never logged, so nothing
 * prompt-like or secret is ever written to the logs (ARCHITECTURE §4;
 * DECISIONS #2).
 */
@Injectable()
export class RedactLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = getRequestContext()?.request_id ?? 'unknown';
    const method = req.method;
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const startedAt = Date.now();

    this.logger.log(`${requestId} ${method} ${path}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - startedAt;
          this.logger.log(
            `${requestId} ${method} ${path} ${res.statusCode} ${elapsed}ms`,
          );
        },
        error: (err: unknown) => {
          const elapsed = Date.now() - startedAt;
          const status =
            errorStatus(err) ??
            (res.statusCode >= 400 ? res.statusCode : 500);
          this.logger.log(
            `${requestId} ${method} ${path} ${status} ${elapsed}ms`,
          );
        },
      }),
    );
  }
}
