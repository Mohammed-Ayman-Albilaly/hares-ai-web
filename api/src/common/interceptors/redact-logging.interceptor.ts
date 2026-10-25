import {
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
 * Logs each request and its response with the correlated `request_id`.
 *
 * Only operational metadata is logged: request_id, method, path (without the
 * query string), response status and duration. Request and response bodies are
 * never logged, so nothing prompt-like or secret is ever written to the logs
 * (ARCHITECTURE §4; DECISIONS #2).
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
      tap(() => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(
          `${requestId} ${method} ${path} ${res.statusCode} ${elapsed}ms`,
        );
      }),
    );
  }
}
