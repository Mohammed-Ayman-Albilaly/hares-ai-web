import {
  MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { RedactLoggingInterceptor } from './interceptors/redact-logging.interceptor';
import { CorrelationMiddleware } from './middleware/correlation.middleware';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';

/**
 * CommonModule wires the cross-cutting concerns for every request:
 *  - correlation id (`request_id`) middleware,
 *  - the consistent error-envelope filter (APP_FILTER),
 *  - the redacting logging interceptor (APP_INTERCEPTOR),
 *  - the Zod validation pipe (APP_PIPE).
 *
 * Middleware is applied here because a module must implement `NestModule` to
 * register middleware; the providers above are global (APP_*).
 */
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RedactLoggingInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    CorrelationMiddleware,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
