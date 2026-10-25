import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { LoginRequest, LoginResponse, RegisterRequest, UserPublic } from '@hares/contract';
import { PrismaService } from '../prisma/prisma.service';
import { USER_PUBLIC_SELECT, toUserPublic } from '../users/user-public';
import { authMessage, unauthorized } from './auth-errors';
import type { ClientKind } from './auth.constants';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

/** Login result: the JSON body plus the raw refresh token for the cookie/body. */
export interface SessionResult {
  body: LoginResponse;
  refreshToken: string;
}

/**
 * Login denial code per status. The web shows a status-specific message
 * (WEB-FR-005); the extension contract groups PENDING and REJECTED as
 * ACCOUNT_NO_ACCESS (contract/src/errors.ts).
 */
const LOGIN_DENIED = {
  web: { PENDING: 'ACCOUNT_PENDING', REJECTED: 'ACCOUNT_REJECTED', DEACTIVATED: 'ACCOUNT_INACTIVE' },
  extension: { PENDING: 'ACCOUNT_NO_ACCESS', REJECTED: 'ACCOUNT_NO_ACCESS', DEACTIVATED: 'ACCOUNT_INACTIVE' },
} as const;

/** True for a PostgreSQL unique violation, however the driver adapter wraps it. */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string; originalCode?: string } };
  return err?.code === 'P2002' || err?.cause?.code === '23505' || err?.cause?.originalCode === '23505';
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(RefreshTokenService) private readonly refreshTokens: RefreshTokenService,
  ) {}

  /** WEB-FR-001/002: create a PENDING account with no role and no department. */
  async register(input: RegisterRequest): Promise<void> {
    if (await this.findIdByEmail(input.email)) {
      throw this.emailTaken();
    }
    const passwordHash = await this.passwords.hash(input.password);
    try {
      await this.prisma.user.create({
        data: {
          id: randomUUID(),
          fullName: input.full_name,
          email: input.email,
          passwordHash,
          status: 'PENDING',
          registeredAt: new Date(),
        },
      });
    } catch (e) {
      // Two registrations racing for the same email: the unique index decides.
      if (isUniqueViolation(e)) throw this.emailTaken();
      throw e;
    }
  }

  /**
   * WEB-FR-003/004/005. A wrong email and a wrong password give the same answer.
   * The account status is only revealed after the password is proven correct.
   */
  async login(input: Pick<LoginRequest, 'email' | 'password'>, client: ClientKind): Promise<SessionResult> {
    const user = await this.findForLogin(input.email);
    const valid = await this.passwords.verify(input.password, user?.passwordHash ?? null);
    if (!user || !valid) {
      throw unauthorized('INVALID_CREDENTIALS');
    }
    if (user.status !== 'ACTIVE') {
      throw unauthorized(LOGIN_DENIED[client][user.status]);
    }
    const refreshToken = await this.refreshTokens.issue(user.id, user.tokenVersion, client);
    return { body: await this.buildBody(user.id, user.tokenVersion, client), refreshToken };
  }

  /** Rotate the refresh token and mint a new access token. */
  async refresh(raw: string | undefined, client: ClientKind): Promise<SessionResult> {
    if (!raw) throw unauthorized('INVALID_TOKEN');
    const result = await this.refreshTokens.rotate(raw, client);
    if (!result.ok) throw unauthorized(result.code);
    return {
      body: await this.buildBody(result.userId, result.tokenVersion, client),
      refreshToken: result.token,
    };
  }

  /**
   * WEB-FR-006 / WEB-FR-071: revoke the whole family. Returns false when the
   * token is missing, unknown or already revoked (the web treats that as a no-op).
   */
  async logout(raw: string | undefined, client: ClientKind): Promise<boolean> {
    return raw ? this.refreshTokens.revokeByToken(raw, client) : false;
  }

  async me(userId: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw unauthorized('INVALID_TOKEN');
    return toUserPublic(user);
  }

  private async buildBody(userId: string, tokenVersion: number, client: ClientKind): Promise<LoginResponse> {
    const user = await this.me(userId);
    return {
      access_token: await this.tokens.signAccess({ sub: userId, tv: tokenVersion }, client),
      token_type: 'Bearer',
      expires_in: this.tokens.accessTtl(client),
      user,
    };
  }

  /** Case-insensitive lookup that matches the unique index on lower(email). */
  private async findIdByEmail(email: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE lower(email) = lower(${email}) LIMIT 1`;
    return rows[0]?.id ?? null;
  }

  private async findForLogin(email: string) {
    const id = await this.findIdByEmail(email);
    if (!id) return null;
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true, status: true, tokenVersion: true },
    });
  }

  private emailTaken(): ConflictException {
    return new ConflictException({ code: 'EMAIL_TAKEN', message: authMessage('EMAIL_TAKEN') });
  }
}
