import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { reconcileFromDay } from './retention';

export interface ReconcileResult {
  /** EventCounter rows inserted or corrected. */
  eventRowsFixed: number;
  /** CategoryCounter rows inserted or corrected. */
  categoryRowsFixed: number;
  /** First UTC day that was recomputed. */
  fromDay: string;
}

/** How long reconcile waits for the counter-table locks before backing off. */
const LOCK_TIMEOUT = '3s';
const ATTEMPTS = 4;

/**
 * Counter reconcile (ARCHITECTURE 5(a)): recompute EventCounter and
 * CategoryCounter from the ActivityLog rows that still exist and repair any
 * drift (a lost increment, a manual change, a crash between steps).
 *
 *  - Only days strictly AFTER the purge boundary day are recomputed (see
 *    retention.ts). Older days may have lost detail rows to the purge, and their
 *    counters are the only record (decision 25), so they are never touched.
 *  - Rows whose truth is zero are set to 0 (never deleted).
 *  - The recount is computed ONCE into a temporary table, and the repair joins
 *    against it, so cost does not grow with the number of counter rows.
 *  - Consistency with concurrent ingestion: the transaction takes
 *    SHARE ROW EXCLUSIVE locks on both counter tables first. Ingestion takes
 *    ROW EXCLUSIVE locks when it upserts counters (inside the same transaction
 *    as its ActivityLog insert), so an ingestion transaction that touched the
 *    counters before the lock is committed (and visible to the recount), and one
 *    that comes later waits and adds its +1 on top of the repaired value.
 *  - Ingestion pauses only while the repair runs (seconds). `lock_timeout`
 *    keeps reconcile from queueing behind a slow ingestion and blocking all
 *    newer ones: it gives up after 3 s and retries a few times with a pause.
 */
@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async reconcile(now = new Date()): Promise<ReconcileResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        return await this.run(now);
      } catch (e) {
        lastError = e;
        if (!isLockTimeout(e)) throw e;
        this.logger.warn(`reconcile could not get the counter locks (attempt ${attempt}/${ATTEMPTS})`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastError;
  }

  private run(now: Date): Promise<ReconcileResult> {
    const fromDay = reconcileFromDay(now);
    const fromTs = `${fromDay}T00:00:00.000Z`;

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
        await tx.$executeRaw`LOCK TABLE "EventCounter", "CategoryCounter" IN SHARE ROW EXCLUSIVE MODE`;

        // ----- event counters -----
        await tx.$executeRaw`
          CREATE TEMP TABLE truth_event ON COMMIT DROP AS
          SELECT (l.event_time AT TIME ZONE 'UTC')::date AS day, l.department_id, l.platform, l.risk_level,
                 l.action, l.user_decision, l.rule_id, count(*)::bigint AS n
            FROM "ActivityLog" l WHERE l.event_time >= ${fromTs}::timestamptz
           GROUP BY 1, 2, 3, 4, 5, 6, 7`;
        const eventUpserted = await tx.$executeRaw`
          INSERT INTO "EventCounter" AS ec (id, day, department_id, platform, risk_level, action, user_decision, rule_id, event_count)
          SELECT gen_random_uuid(), t.day, t.department_id, t.platform, t.risk_level, t.action, t.user_decision, t.rule_id, t.n
            FROM truth_event t
          ON CONFLICT (day, department_id, platform, risk_level, action, user_decision, rule_id)
          DO UPDATE SET event_count = EXCLUDED.event_count
          WHERE ec.event_count <> EXCLUDED.event_count`;
        const eventZeroed = await tx.$executeRaw`
          UPDATE "EventCounter" c SET event_count = 0
           WHERE c.day >= ${fromDay}::date AND c.event_count <> 0
             AND NOT EXISTS (
               SELECT 1 FROM truth_event t
                WHERE t.day = c.day AND t.department_id IS NOT DISTINCT FROM c.department_id
                  AND t.platform = c.platform AND t.risk_level = c.risk_level AND t.action = c.action
                  AND t.user_decision = c.user_decision AND t.rule_id IS NOT DISTINCT FROM c.rule_id)`;

        // ----- category counters -----
        await tx.$executeRaw`
          CREATE TEMP TABLE truth_category ON COMMIT DROP AS
          SELECT (l.event_time AT TIME ZONE 'UTC')::date AS day, l.department_id, l.platform,
                 lc.category_code, l.risk_level, count(*)::bigint AS n
            FROM "ActivityLog" l JOIN "LogCategory" lc ON lc.log_id = l.log_id
           WHERE l.event_time >= ${fromTs}::timestamptz
           GROUP BY 1, 2, 3, 4, 5`;
        const categoryUpserted = await tx.$executeRaw`
          INSERT INTO "CategoryCounter" AS cc (id, day, department_id, platform, category_code, risk_level, event_count)
          SELECT gen_random_uuid(), t.day, t.department_id, t.platform, t.category_code, t.risk_level, t.n
            FROM truth_category t
          ON CONFLICT (day, department_id, platform, category_code, risk_level)
          DO UPDATE SET event_count = EXCLUDED.event_count
          WHERE cc.event_count <> EXCLUDED.event_count`;
        const categoryZeroed = await tx.$executeRaw`
          UPDATE "CategoryCounter" c SET event_count = 0
           WHERE c.day >= ${fromDay}::date AND c.event_count <> 0
             AND NOT EXISTS (
               SELECT 1 FROM truth_category t
                WHERE t.day = c.day AND t.department_id IS NOT DISTINCT FROM c.department_id
                  AND t.platform = c.platform AND t.category_code = c.category_code AND t.risk_level = c.risk_level)`;

        return {
          eventRowsFixed: eventUpserted + eventZeroed,
          categoryRowsFixed: categoryUpserted + categoryZeroed,
          fromDay,
        };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  }
}

/** PostgreSQL 55P03 lock_not_available, however the driver adapter wraps it. */
function isLockTimeout(e: unknown): boolean {
  const err = e as { code?: string; message?: string; cause?: { code?: string; originalCode?: string } };
  return (
    err?.cause?.code === '55P03' ||
    err?.cause?.originalCode === '55P03' ||
    err?.code === '55P03' ||
    /lock timeout|55P03/i.test(err?.message ?? '')
  );
}
