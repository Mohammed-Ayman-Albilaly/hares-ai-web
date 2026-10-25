import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';
import {
  EXTENSION_ACCESS_TTL_SECONDS,
  JWT_ISSUER,
  WEB_ACCESS_TTL_SECONDS,
  type ClientKind,
} from './auth.constants';

export interface AccessClaims {
  /** User id. */
  sub: string;
  /** The user's token_version when the token was issued. */
  tv: number;
}

export type VerifyResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: 'expired' | 'invalid' };

/**
 * Access JWTs (HS256) and opaque refresh tokens.
 *
 * The access token carries only the user id and token_version; role, status
 * and department are always read from the database by the guard, never trusted
 * from the token. The `aud` claim is the client kind, so a web token cannot be
 * used on an extension endpoint and vice versa.
 *
 * Refresh tokens are 32 random bytes; only their SHA-256 hash is stored. A fast
 * hash is enough here because the token has 256 bits of entropy (unlike a
 * password).
 */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (secret) {
      this.key = new TextEncoder().encode(secret);
    } else {
      // Only reachable under NODE_ENV=test (env validation requires it otherwise).
      new Logger('TokenService').warn('JWT_ACCESS_SECRET not set; using a random per-process secret.');
      this.key = randomBytes(48);
    }
  }

  accessTtl(client: ClientKind): number {
    return client === 'web' ? WEB_ACCESS_TTL_SECONDS : EXTENSION_ACCESS_TTL_SECONDS;
  }

  async signAccess(claims: AccessClaims, client: ClientKind): Promise<string> {
    return new SignJWT({ tv: claims.tv })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuer(JWT_ISSUER)
      .setAudience(client)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtl(client)}s`)
      .sign(this.key);
  }

  async verifyAccess(token: string, client: ClientKind): Promise<VerifyResult> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: client,
      });
      if (typeof payload.sub !== 'string' || !Number.isInteger(payload.tv)) {
        return { ok: false, reason: 'invalid' };
      }
      return { ok: true, claims: { sub: payload.sub, tv: payload.tv as number } };
    } catch (e) {
      return { ok: false, reason: e instanceof joseErrors.JWTExpired ? 'expired' : 'invalid' };
    }
  }

  newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
