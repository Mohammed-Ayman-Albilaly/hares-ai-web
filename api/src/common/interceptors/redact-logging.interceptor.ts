import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { getRequestContext } from '../request-context';

const REDACTED = '[REDACTED]';

/**
 * Fields whose values are never logged, regardless of depth. Anything a user
 * might type that resembles a prompt, secret or placeholder is redacted.
 */
const SENSITIVE_KEYS =
  /(password|passwd|secret|token|prompt|placeholder|placeholder_value|original|revised|masked|content|body|api[-_]?key)/i;

/**
 * Recursively redact sensitive values from an object/array, capping nesting so
 * a deeply nested body cannot be echoed or blow the log line.
 */
function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.test(key) ? REDACTED : redact(child, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Logs each request and its response with the correlated `request_id`, with
 * request/response bodies redacted so nothing prompt-like or secret is ever
 * written to the logs (ARCHITECTURE §4; DECISIONS #2).
 */
@Injectable()
export class RedactLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = getRequestContext()?.request_id ?? 'unknown';
    const { method, originalUrl } = req;
    const startedAt = Date.now();

    this.logger.log(
      `${requestId} ${method} ${originalUrl} req=${JSON.stringify(redact(req.body ?? {}))}`,
    );

    return next.handle().pipe(
      tap((body) => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(
          `${requestId} ${method} ${originalUrl} ${elapsed}ms res=${JSON.stringify(redact(body))}`,
        );
      }),
    );
  }
}
