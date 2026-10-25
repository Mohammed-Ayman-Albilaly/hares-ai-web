import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { purgeBoundary } from './retention';

export interface PurgeResult {
  activityLogs: number;
  loginAttempts: number;
  passwordResetTokens: number;
  refreshTokens: number;
}

const BATCH = 5000;

/**
 * Retention purge (WEB-FR-067; decisions 11, 25).
 *
 *  - ActivityLog detail rows older than 90 days (by event_time, cut at midnight
 *    UTC, so they live 90 to 91 days) are deleted in batches of 5000, each batch its own short statement, so a large backlog
 *    never holds one long lock or bloats one transaction. LogCategory rows go
 *    with them (ON DELETE CASCADE).
 *  - EventCounter, CategoryCounter and AdminAuditLog are NEVER touched: counters
 *    keep dashboards correct for purged periods, the audit trail is
 *    append-only and permanent.
 *  - The same run clears short-lived security rows that would otherwise grow
 *    without bound: stale login-attempt counters, expired reset tokens and
 *    long-expired refresh tokens.
 *
 * The API runs as a single instance (decision 27), so an in-process guard
 * prevents overlapping runs. If the API is ever replicated, wrap the run in a
 * PostgreSQL advisory lock (pg_try_advisory_lock) as well.
 */
@Injectable()
export class PurgeService {
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Returns null when a purge is already running. */
  async purge(now = new Date()): Promise<PurgeResult | null> {
    if (this.running) return null;
    this.running = true;
    try {
      // Midnight UTC of the day 90 days back (see retention.ts): reconcile and purge never disagree about a day.
      const cutoff = purgeBoundary(now).toISOString();
      let activityLogs = 0;
      for (;;) {
        const deleted = await this.prisma.$executeRaw`
          DELETE FROM "ActivityLog"
           WHERE log_id IN (SELECT log_id FROM "ActivityLog"
                             WHERE event_time < ${cutoff}::timestamptz
                             ORDER BY event_time LIMIT ${BATCH})`;
        activityLogs += deleted;
        if (deleted < BATCH) break;
      }

      const loginAttempts = await this.prisma.$executeRaw`
        DELETE FROM "LoginAttempt"
         WHERE window_start < now() - interval '1 day'
           AND (next_allowed_at IS NULL OR next_allowed_at < now())`;
      const passwordResetTokens = await this.prisma.$executeRaw`
        DELETE FROM "PasswordResetToken" WHERE expires_at < now() - interval '1 day'`;
      const refreshTokens = await this.prisma.$executeRaw`
        DELETE FROM "RefreshToken" WHERE expires_at < now() - interval '1 day'`;

      return { activityLogs, loginAttempts, passwordResetTokens, refreshTokens };
    } finally {
      this.running = false;
    }
  }
}
