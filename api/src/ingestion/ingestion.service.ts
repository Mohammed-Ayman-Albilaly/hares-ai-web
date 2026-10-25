import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EVENT_TIME_MAX_AGE_DAYS,
  EVENT_TIME_MAX_FUTURE_SKEW_MINUTES,
  type LogEvent,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { IngestionRejectedException } from './ingestion-rejected.exception';

export interface IngestResult {
  /** true: a new row was stored (201). false: duplicate log_id, acknowledged only (200). */
  created: boolean;
}

/**
 * Metadata-only log ingestion (WEB-FR-045..049, 056, 072; decisions 2, 8, 21, 33).
 *
 *  - Identity: user_id and department_id come from the authenticated, live
 *    user row (the guard re-reads it on every request); the department is
 *    stored as a snapshot. The payload can never set them (strict allowlist).
 *  - A deactivated department blocks ingestion for its users (403).
 *  - event_time must be at most 5 minutes in the future and at most 90 days old.
 *  - Idempotent by log_id: `INSERT ... ON CONFLICT (log_id) DO NOTHING RETURNING`.
 *    The counters and the category rows are written in the SAME transaction and
 *    only when that statement returned a row, so a duplicate never counts twice.
 *
 * Raw SQL is used where Prisma cannot express the statement: ON CONFLICT DO
 * NOTHING with RETURNING, and counter upserts against the NULLS NOT DISTINCT
 * unique indexes.
 */
@Injectable()
export class IngestionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ingest(user: AuthUser, event: LogEvent, now = new Date()): Promise<IngestResult> {
    const eventTime = this.checkEventTime(event.event_time, now);
    const ruleId = event.rule_id ?? null;
    // Sorted: concurrent events lock the shared CategoryCounter rows in the same
    // order, so two events can never deadlock on each other.
    const categories = [...event.categories].sort();

    return this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: the department may have been deactivated
      // since the guard ran.
      if (user.departmentId) {
        const dept = await tx.$queryRaw<{ active: boolean }[]>`
          SELECT active FROM "Department" WHERE id = ${user.departmentId}::uuid`;
        if (!dept[0]?.active) {
          throw new IngestionRejectedException(
            'DEPARTMENT_INACTIVE',
            HttpStatus.FORBIDDEN,
            'Log ingestion is blocked for this department.',
          );
        }
      }
      if (ruleId) {
        const known = await tx.customRule.count({ where: { id: ruleId } });
        if (known === 0) {
          throw new IngestionRejectedException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, 'Request validation failed', {
            rule_id: ['rule.unknown'],
          });
        }
      }

      const inserted = await tx.$queryRaw<{ log_id: string }[]>`
        INSERT INTO "ActivityLog" (log_id, user_id, department_id, platform, risk_level, action,
                                   classification_source, user_decision, rule_id, schema_version,
                                   event_time, received_at)
        VALUES (${event.log_id}::uuid, ${user.id}::uuid, ${user.departmentId}::uuid,
                ${event.platform}::platform, ${event.risk_level}::risk_level, ${event.action}::log_action,
                ${event.classification_source}::classification_source, ${event.user_decision}::user_decision,
                ${ruleId}::uuid, ${event.schema_version}::int, ${eventTime}::timestamptz, now())
        ON CONFLICT (log_id) DO NOTHING
        RETURNING log_id`;
      if (inserted.length === 0) return { created: false };

      if (categories.length > 0) {
        await tx.$executeRaw`
          INSERT INTO "LogCategory" (log_id, category_code)
          SELECT ${event.log_id}::uuid, c FROM unnest(${categories}::text[]) AS c`;
      }

      // Event-level counter (totals come from here only).
      await tx.$executeRaw`
        INSERT INTO "EventCounter" (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
        VALUES (${randomUUID()}::uuid, (${eventTime}::timestamptz AT TIME ZONE 'UTC')::date, ${user.departmentId}::uuid,
                ${event.platform}::platform, ${event.risk_level}::risk_level, ${event.action}::log_action,
                ${event.user_decision}::user_decision, ${ruleId}::uuid, 1)
        ON CONFLICT (day, department_id, platform, risk_level, action, user_decision, rule_id)
        DO UPDATE SET event_count = "EventCounter".event_count + 1`;

      // Category-level counter (per-category breakdown for the charts).
      if (categories.length > 0) {
        await tx.$executeRaw`
          INSERT INTO "CategoryCounter" (id, day, department_id, platform, category_code, risk_level, event_count)
          SELECT gen_random_uuid(), (${eventTime}::timestamptz AT TIME ZONE 'UTC')::date, ${user.departmentId}::uuid,
                 ${event.platform}::platform, c, ${event.risk_level}::risk_level, 1
          FROM unnest(${categories}::text[]) AS c
          ORDER BY c
          ON CONFLICT (day, department_id, platform, category_code, risk_level)
          DO UPDATE SET event_count = "CategoryCounter".event_count + 1`;
      }
      return { created: true };
      // A reconcile may hold the counter tables for a few seconds: wait it out
      // instead of failing at Prisma's default 5 s transaction timeout.
    }, { timeout: 20_000, maxWait: 15_000 });
  }

  /** WEB-FR-072 / decision 33. Returns the normalised ISO string. */
  private checkEventTime(iso: string, now: Date): string {
    const t = new Date(iso);
    const maxFuture = now.getTime() + EVENT_TIME_MAX_FUTURE_SKEW_MINUTES * 60_000;
    const maxAge = now.getTime() - EVENT_TIME_MAX_AGE_DAYS * 86_400_000;
    if (Number.isNaN(t.getTime()) || t.getTime() > maxFuture || t.getTime() < maxAge) {
      throw new IngestionRejectedException(
        'EVENT_TIME_OUT_OF_RANGE',
        HttpStatus.BAD_REQUEST,
        'event_time is more than 5 minutes in the future or older than 90 days.',
      );
    }
    return t.toISOString();
  }
}
