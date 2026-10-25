import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClientKind } from '../../auth/auth.constants';
import type { AuthUser } from '../auth-user';

export const IS_PUBLIC_KEY = 'hares:is-public';
export const CLIENT_KIND_KEY = 'hares:client-kind';

/** Skip the global JwtAuthGuard (register, login, refresh, health, ...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Which access-token audience a route accepts. Routes default to `web`. */
export const ForClient = (client: ClientKind) => SetMetadata(CLIENT_KIND_KEY, client);

/** Inject the user loaded by the JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<Request & { authUser: AuthUser }>().authUser,
);
