import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { forbidden } from '../../auth/auth-errors';

/**
 * CSRF defence for the /auth routes, on top of SameSite=Strict: if the
 * browser sends an Origin header, it must be in the CORS_ORIGIN allowlist.
 * Requests without Origin (curl, server tools) carry no ambient browser
 * cookie and are allowed.
 *
 * In production CORS_ORIGIN must list the public web origin (decision 27).
 */
@Injectable()
export class AllowedOriginGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.allowed = new Set(
      (config.get<string>('CORS_ORIGIN') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (origin === undefined || this.allowed.has(origin)) return true;
    throw forbidden('ORIGIN_NOT_ALLOWED');
  }
}
