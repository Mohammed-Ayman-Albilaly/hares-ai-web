import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { unauthorized } from '../../auth/auth-errors';
import type { ClientKind } from '../../auth/auth.constants';
import { TokenService } from '../../auth/token.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../auth-user';
import { CLIENT_KIND_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global authentication guard (ARCHITECTURE §2 "Revocation design"). For every
 * non-public route it checks, in order:
 *   1. a Bearer token is present and its signature, issuer, audience (client
 *      kind) and expiry are valid;
 *   2. the user exists and the token's token_version equals the current one
 *      (so deactivate / reject / password change revoke tokens immediately);
 *   3. the account is ACTIVE.
 * It costs one primary-key SELECT; there is no cache, so revocation is immediate.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const client = this.reflector.getAllAndOverride<ClientKind>(CLIENT_KIND_KEY, targets) ?? 'web';

    const req = context.switchToHttp().getRequest<Request & { authUser?: AuthUser }>();
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer (\S+)$/.exec(header) : null;
    if (!match) throw unauthorized('INVALID_TOKEN');

    const verified = await this.tokens.verifyAccess(match[1], client);
    if (!verified.ok) {
      throw unauthorized(verified.reason === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
    }
    const { sub, tv } = verified.claims;
    if (!UUID_RE.test(sub)) throw unauthorized('INVALID_TOKEN');

    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, status: true, tokenVersion: true, role: true, departmentId: true },
    });
    if (!user) throw unauthorized('INVALID_TOKEN');
    if (user.tokenVersion !== tv) throw unauthorized('TOKEN_REVOKED');
    if (user.status !== 'ACTIVE') throw unauthorized('ACCOUNT_INACTIVE');

    req.authUser = {
      id: user.id,
      status: user.status,
      role: user.role,
      departmentId: user.departmentId,
      client,
    };
    return true;
  }
}
