import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../mail/mailer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimitedException } from '../auth-errors';
import { LoginFailureStore, changePasswordKey } from '../login-failure-store';
import { PasswordService } from '../password.service';
import { RESET_EMAILS_PER_WINDOW, THROTTLE_WINDOW_SECONDS } from '../throttle';
import { buildResetEmail } from './reset-email';

/** Reset links expire after 30 minutes (decision 15). */
export const RESET_TTL_SECONDS = 30 * 60;

/**
 * Forgot / reset / change password (WEB-FR-007, WEB-FR-058, decision 15).
 *
 *  - forgot: always answers the same. The lookup and email run in the
 *    background after the response, so timing does not reveal whether the
 *    email exists (decision 29). Only ACTIVE accounts get an email, and at most
 *    3 per 15 minutes per account.
 *  - The token is 32 random bytes; only its SHA-256 hash is stored, it is
 *    single-use and expires after 30 minutes. Issuing a new one invalidates
 *    older unused ones.
 *  - reset and change both bump token_version and revoke every refresh family,
 *    so all existing sessions (web and extension) end (WEB-FR-059).
 */
@Injectable()
export class PasswordResetService implements OnApplicationShutdown {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly webBaseUrl: string;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(LoginFailureStore) private readonly failures: LoginFailureStore,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.webBaseUrl = (config.get<string>('WEB_BASE_URL') ?? 'http://localhost:1420').replace(/\/+$/, '');
  }

  /** Accept the request and process it after the response is sent. */
  requestReset(email: string): void {
    const job = this.processReset(email)
      .catch((e) => this.logger.error(`reset request failed (${errorCode(e)})`))
      .finally(() => this.inFlight.delete(job));
    this.inFlight.add(job);
  }

  /** Resolves when all background reset jobs are done (used by tests and shutdown). */
  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all([...this.inFlight]);
  }

  /** Let in-flight reset emails finish before Prisma disconnects. */
  onApplicationShutdown(): Promise<void> {
    return this.whenIdle();
  }

  async reset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const passwordHash = await this.passwords.hash(newPassword);

    const email = await this.prisma.$transaction(async (tx) => {
      const row = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, status: true, email: true } } },
      });
      if (!row || row.used || row.expiresAt <= new Date() || row.user.status !== 'ACTIVE') return null;
      // Conditional update: a concurrent second use of the same link loses.
      const marked = await tx.passwordResetToken.updateMany({
        where: { id: row.id, used: false },
        data: { used: true },
      });
      if (marked.count !== 1) return null;
      await this.setPasswordIn(tx, row.user.id, passwordHash);
      return row.user.email;
    });

    if (!email) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'This reset link is invalid or has expired.',
      });
    }
    // A reset clears the login throttle for the account (WEB-NFR-020).
    await this.failures.clearAccountAllClients(email);
  }

  /** WEB-FR-058. The caller issues the new session for the current device. */
  async change(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Same progressive throttle as login, keyed by the signed-in user, so a
    // stolen access token cannot be used to guess the current password.
    const key = changePasswordKey(userId);
    const wait = await this.failures.reserveKey(key);
    if (wait > 0) throw new RateLimitedException(wait);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await this.passwords.verify(currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'The current password is not correct.',
      });
    }
    await this.failures.clearAccount(key);
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction((tx) => this.setPasswordIn(tx, userId, passwordHash));
  }

  private async processReset(email: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ id: string; email: string; status: string }[]>`
      SELECT id, email, status::text AS status FROM "User" WHERE lower(email) = lower(${email}) LIMIT 1`;
    const user = rows[0];
    if (!user || user.status !== 'ACTIVE') return;

    const raw = randomBytes(32).toString('base64url');
    const issued = await this.prisma.$transaction(async (tx) => {
      // Serialize per user so parallel requests cannot all pass the limit.
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${'reset:' + user.id}))) AS l`;
      const since = new Date(Date.now() - THROTTLE_WINDOW_SECONDS * 1000);
      const recent = await tx.passwordResetToken.count({
        where: { userId: user.id, createdAt: { gte: since } },
      });
      if (recent >= RESET_EMAILS_PER_WINDOW) return false;
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });
      await tx.passwordResetToken.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + RESET_TTL_SECONDS * 1000),
        },
      });
      return true;
    });
    if (!issued) return;

    // The token goes in the URL fragment: it is never sent to a server or in Referer.
    const link = `${this.webBaseUrl}/reset-password#token=${raw}`;
    await this.mailer.send({ to: user.email, ...buildResetEmail(link, RESET_TTL_SECONDS / 60) });
  }

  private async setPasswordIn(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Any reset link issued before this change is no longer valid.
    await tx.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });
  }
}

/** A safe label for a failure: never the message (it may contain the recipient). */
function errorCode(e: unknown): string {
  const err = e as { code?: unknown; responseCode?: unknown; name?: unknown };
  return String(err?.code ?? err?.responseCode ?? err?.name ?? 'unknown');
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
