import { Injectable, UseGuards, applyDecorators, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { forbidden } from '../../auth/auth-errors';
import type { AuthUser } from '../auth-user';
import { ForClient } from '../decorators/auth.decorators';

/**
 * Second check for extension-only routes (log ingestion, policy bundle). The
 * global JwtAuthGuard already verified `aud = extension` because of
 * `@ForClient('extension')`; this guard re-asserts the client kind on the
 * loaded user so a route can never be reached with a web token, even if the
 * metadata is changed by mistake. An admin's web session cannot ingest logs.
 */
@Injectable()
export class ExtensionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { authUser?: AuthUser }>();
    if (req.authUser?.client === 'extension') return true;
    throw forbidden('FORBIDDEN');
  }
}

/** Mark a controller or route as extension-only (aud check + ExtensionGuard). */
export const ExtensionOnly = () => applyDecorators(ForClient('extension'), UseGuards(ExtensionGuard));
