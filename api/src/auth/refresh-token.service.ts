import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REFRESH_TTL_SECONDS, type ClientKind } from './auth.constants';
import { TokenService } from './token.service';

const CLIENT_TYPE = { web: 'WEB', extension: 'EXTENSION' } as const;

export type RotateResult =
  | { ok: true; token: string; userId: string; tokenVersion: number }
  | { ok: false; code: 'INVALID_TOKEN' | 'TOKEN_REVOKED' | 'REFRESH_REUSED' };

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * Server-side refresh-token store with rotation and reuse detection
 * (ARCHITECTURE §2 "Revocation design").
 *
 *  - Each login starts a new family. Each refresh marks the presented token
 *    `used` and issues a successor in the same family.
 *  - Presenting a token that is already used (a replay) revokes the whole
 *    family, so both the attacker and the real user must sign in again.
 *  - A family also dies when the user's token_version changes (deactivate,
 *    reject, password change/reset) or the user is no longer ACTIVE.
 *  - A token is bound to its client type: a web cookie never works on the
 *    extension endpoint and the reverse.
 *
 * Rotation and revocation of one family are serialized with a PostgreSQL
 * advisory lock, so a logout racing a refresh can never leave a live successor
 * behind in a revoked family.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  /** Start a new family for a fresh login. Returns the raw token (never stored). */
  async issue(userId: string, tokenVersion: number, client: ClientKind): Promise<string> {
    const raw = this.tokens.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: this.row(raw, userId, tokenVersion, client, randomUUID()),
    });
    return raw;
  }

  async rotate(raw: string, client: ClientKind): Promise<RotateResult> {
    const found = await this.findByRaw(raw);
    if (!found || found.clientType !== CLIENT_TYPE[client]) {
      return { ok: false, code: 'INVALID_TOKEN' };
    }

    // Every branch returns (never throws), so a revocation decided inside the
    // transaction is committed.
    return this.prisma.$transaction(async (tx): Promise<RotateResult> => {
      await this.lockFamily(tx, found.familyId);
      const current = await tx.refreshToken.findUniqueOrThrow({
        where: { id: found.id },
        include: { user: { select: { status: true, tokenVersion: true } } },
      });

      if (current.revokedAt) {
        return { ok: false, code: 'TOKEN_REVOKED' };
      }
      if (current.used) {
        await this.revokeFamilyIn(tx, current.familyId);
        return { ok: false, code: 'REFRESH_REUSED' };
      }
      if (current.expiresAt <= new Date()) {
        return { ok: false, code: 'INVALID_TOKEN' };
      }
      if (current.user.status !== 'ACTIVE' || current.user.tokenVersion !== current.tokenVersion) {
        await this.revokeFamilyIn(tx, current.familyId);
        return { ok: false, code: 'TOKEN_REVOKED' };
      }

      const next = this.tokens.newRefreshToken();
      await tx.refreshToken.update({ where: { id: current.id }, data: { used: true } });
      await tx.refreshToken.create({
        data: this.row(next, current.userId, current.tokenVersion, client, current.familyId),
      });
      return { ok: true, token: next, userId: current.userId, tokenVersion: current.tokenVersion };
    });
  }

  /** Revoke the family of the presented token (logout). Unknown tokens are ignored. */
  async revokeByToken(raw: string, client: ClientKind): Promise<boolean> {
    const row = await this.findByRaw(raw);
    if (!row || row.clientType !== CLIENT_TYPE[client] || row.revokedAt) return false;
    await this.revokeFamily(row.familyId);
    return true;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockFamily(tx, familyId);
      await this.revokeFamilyIn(tx, familyId);
    });
  }

  private findByRaw(raw: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(raw) },
      select: { id: true, familyId: true, clientType: true, revokedAt: true },
    });
  }

  /** Transaction-scoped advisory lock keyed by the family id (released on commit). */
  private async lockFamily(tx: Tx, familyId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${familyId}::text))) AS l`;
  }

  private async revokeFamilyIn(tx: Tx, familyId: string): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private row(raw: string, userId: string, tokenVersion: number, client: ClientKind, familyId: string) {
    return {
      id: randomUUID(),
      userId,
      tokenHash: this.tokens.hashRefreshToken(raw),
      familyId,
      clientType: CLIENT_TYPE[client],
      tokenVersion,
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    };
  }
}
