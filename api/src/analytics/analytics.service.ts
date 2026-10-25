import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ANALYTICS_DEFAULT_RANGE_DAYS,
  ANALYTICS_MAX_RANGE_DAYS,
  OWN_DASHBOARD_MAX_DAYS,
  type AnalyticsQuery,
  type DashboardScope,
  type DashboardSummaryResponse,
  type DashboardTimeseriesResponse,
  type DepartmentBreakdown,
  type TimeseriesPoint,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { ValidationException } from '../common/validation-exception';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

/** Where the numbers come from and how they are filtered. */
interface Source {
  scope: DashboardScope;
  /** Relation with columns day, department_id, platform, risk_level, action, user_decision, event_count. */
  events: Prisma.Sql;
  /** Relation with columns day, department_id, platform, category_code, risk_level, event_count. */
  categories: Prisma.Sql;
  /** Extra filter on the department (counters only). */
  departmentId: string | null;
  totalUsers: () => Promise<number>;
  withDepartments: boolean;
}

interface Range {
  from: string;
  to: string;
}

const n = (v: unknown): number => Number(v ?? 0);

/**
 * Role-scoped dashboard aggregates (WEB-FR-028..033, 066; WEB-NFR-010).
 *
 *  - Department and organisation dashboards read ONLY the pre-aggregated
 *    counters (EventCounter for totals / platforms / risk, CategoryCounter for
 *    categories). Totals come from EventCounter alone, so nothing is counted
 *    twice. This service never writes. Counters are written at ingestion, so
 *    the lag is zero; the reconcile job repairs drift.
 *  - The personal dashboard reads the user's live ActivityLog rows (the counters
 *    carry no user identity, decision 25), so it covers at most 90 days
 *    (decision 26).
 * Scope always comes from the guard-loaded user row.
 */
@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ---------- public entry points ----------

  summaryOwn(actor: AuthUser, q: AnalyticsQuery): Promise<DashboardSummaryResponse> {
    return this.summary(this.ownSource(actor.id), this.range(q, OWN_DASHBOARD_MAX_DAYS));
  }

  timeseriesOwn(actor: AuthUser, q: AnalyticsQuery): Promise<DashboardTimeseriesResponse> {
    return this.timeseries(this.ownSource(actor.id), this.range(q, OWN_DASHBOARD_MAX_DAYS));
  }

  async summaryDepartment(actor: AuthUser, q: AnalyticsQuery): Promise<DashboardSummaryResponse> {
    return this.summary(await this.departmentSource(actor, q), this.range(q));
  }

  async timeseriesDepartment(actor: AuthUser, q: AnalyticsQuery): Promise<DashboardTimeseriesResponse> {
    return this.timeseries(await this.departmentSource(actor, q), this.range(q));
  }

  summaryOrg(q: AnalyticsQuery): Promise<DashboardSummaryResponse> {
    return this.summary(this.orgSource(), this.range(q));
  }

  timeseriesOrg(q: AnalyticsQuery): Promise<DashboardTimeseriesResponse> {
    return this.timeseries(this.orgSource(), this.range(q));
  }

  // ---------- sources ----------

  private orgSource(): Source {
    return {
      scope: 'ORG',
      events: Prisma.sql`"EventCounter"`,
      categories: Prisma.sql`"CategoryCounter"`,
      departmentId: null,
      withDepartments: true,
      totalUsers: () => this.prisma.user.count({ where: { status: 'ACTIVE' } }),
    };
  }

  /** A Department Admin is pinned to their own department; a System Admin names one. */
  private async departmentSource(actor: AuthUser, q: AnalyticsQuery): Promise<Source> {
    let departmentId: string;
    if (actor.role === 'DEPARTMENT_ADMIN') {
      if (!actor.departmentId) throw new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.' });
      departmentId = actor.departmentId;
    } else {
      if (!q.department_id) throw new ValidationException({ department_id: ['analytics.department_required'] });
      departmentId = q.department_id;
      if ((await this.prisma.department.count({ where: { id: departmentId } })) === 0) {
        throw new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.' });
      }
    }
    return {
      scope: 'DEPARTMENT',
      events: Prisma.sql`"EventCounter"`,
      categories: Prisma.sql`"CategoryCounter"`,
      departmentId,
      withDepartments: false,
      totalUsers: () => this.prisma.user.count({ where: { status: 'ACTIVE', departmentId } }),
    };
  }

  /** Live rows of one user, shaped like the counters (weight 1 per event). */
  private ownSource(userId: string): Source {
    return {
      scope: 'OWN',
      events: Prisma.sql`(
        SELECT (l.event_time AT TIME ZONE 'UTC')::date AS day, l.department_id, l.platform, l.risk_level,
               l.action, l.user_decision, 1::bigint AS event_count
          FROM "ActivityLog" l WHERE l.user_id = ${userId}::uuid)`,
      categories: Prisma.sql`(
        SELECT (l.event_time AT TIME ZONE 'UTC')::date AS day, l.department_id, l.platform, lc.category_code,
               l.risk_level, 1::bigint AS event_count
          FROM "ActivityLog" l JOIN "LogCategory" lc ON lc.log_id = l.log_id WHERE l.user_id = ${userId}::uuid)`,
      departmentId: null,
      withDepartments: false,
      totalUsers: async () => 1,
    };
  }

  // ---------- queries ----------

  private async summary(src: Source, r: Range): Promise<DashboardSummaryResponse> {
    const where = this.where(src, r);
    const [totalsRows, platformRows, categoryRows, deptRows, totalUsers] = await Promise.all([
      this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT COALESCE(sum(e.event_count), 0)::bigint AS total,
               COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'BLOCKED'), 0)::bigint AS blocked,
               COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'WARNED'), 0)::bigint AS warned,
               COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'ALLOWED'), 0)::bigint AS allowed,
               COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'HIGH'), 0)::bigint AS high,
               COALESCE(sum(e.event_count) FILTER (WHERE e.user_decision = 'SUBMITTED_ANYWAY'
                                                      AND e.action IN ('WARNED', 'BLOCKED')), 0)::bigint AS overridden
          FROM ${src.events} e WHERE ${where}`),
      this.prisma.$queryRaw<{ platform: string; count: bigint }[]>(Prisma.sql`
        SELECT e.platform::text AS platform, sum(e.event_count)::bigint AS count
          FROM ${src.events} e WHERE ${where} GROUP BY e.platform ORDER BY count DESC, platform`),
      this.prisma.$queryRaw<{ category_code: string; count: bigint }[]>(Prisma.sql`
        SELECT c.category_code, sum(c.event_count)::bigint AS count
          FROM ${src.categories} c WHERE ${this.where(src, r, 'c')}
         GROUP BY c.category_code ORDER BY count DESC, c.category_code LIMIT 10`),
      src.withDepartments
        ? this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
            SELECT e.department_id, d.name AS department_name,
                   sum(e.event_count)::bigint AS total,
                   COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'HIGH'), 0)::bigint AS high,
                   COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'MEDIUM'), 0)::bigint AS medium,
                   COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'LOW'), 0)::bigint AS low,
                   COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'NONE'), 0)::bigint AS none,
                   COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'BLOCKED'), 0)::bigint AS blocked,
                   COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'WARNED'), 0)::bigint AS warned
              FROM ${src.events} e LEFT JOIN "Department" d ON d.id = e.department_id
             WHERE ${where} GROUP BY e.department_id, d.name ORDER BY total DESC, d.name`)
        : Promise.resolve(undefined),
      src.totalUsers(),
    ]);

    const t = totalsRows[0];
    const total = n(t.total);
    const blocked = n(t.blocked);
    const warned = n(t.warned);
    const intercepted = blocked + warned;
    return {
      scope: src.scope,
      from: r.from,
      to: r.to,
      total_users: totalUsers,
      totals: {
        total_events: total,
        intercepted,
        blocked,
        warned,
        allowed: n(t.allowed),
        high_risk: n(t.high),
        high_risk_percent: pct(n(t.high), total),
        override_rate_percent: pct(n(t.overridden), intercepted),
      },
      platforms: platformRows.map((p) => ({ platform: p.platform as 'CHATGPT', count: n(p.count) })),
      top_categories: categoryRows.map((c) => ({ category_code: c.category_code as 'LOCATION', count: n(c.count) })),
      ...(deptRows
        ? {
            departments: deptRows.map(
              (d): DepartmentBreakdown => ({
                department_id: (d.department_id as string | null) ?? null,
                department_name: (d.department_name as string | null) ?? null,
                total: n(d.total),
                high: n(d.high),
                medium: n(d.medium),
                low: n(d.low),
                none: n(d.none),
                blocked: n(d.blocked),
                warned: n(d.warned),
              }),
            ),
          }
        : {}),
      lag_seconds: 0,
    };
  }

  private async timeseries(src: Source, r: Range): Promise<DashboardTimeseriesResponse> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT e.day::text AS day,
             sum(e.event_count)::bigint AS total,
             COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'HIGH'), 0)::bigint AS high,
             COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'MEDIUM'), 0)::bigint AS medium,
             COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'LOW'), 0)::bigint AS low,
             COALESCE(sum(e.event_count) FILTER (WHERE e.risk_level = 'NONE'), 0)::bigint AS none,
             COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'BLOCKED'), 0)::bigint AS blocked,
             COALESCE(sum(e.event_count) FILTER (WHERE e.action = 'WARNED'), 0)::bigint AS warned
        FROM ${src.events} e WHERE ${this.where(src, r)} GROUP BY e.day ORDER BY e.day`);
    const byDay = new Map(rows.map((x) => [String(x.day), x]));

    // One point per day of the range, zero-filled, so a chart has no gaps.
    const points: TimeseriesPoint[] = [];
    for (let t = Date.parse(r.from); t <= Date.parse(r.to); t += 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      const x = byDay.get(day);
      points.push({
        day,
        total: n(x?.total),
        high: n(x?.high),
        medium: n(x?.medium),
        low: n(x?.low),
        none: n(x?.none),
        blocked: n(x?.blocked),
        warned: n(x?.warned),
      });
    }
    return { scope: src.scope, from: r.from, to: r.to, points };
  }

  private where(src: Source, r: Range, alias: 'e' | 'c' = 'e'): Prisma.Sql {
    const col = (c: string) => Prisma.raw(`${alias}.${c}`);
    const parts = [Prisma.sql`${col('day')} BETWEEN ${r.from}::date AND ${r.to}::date`];
    if (src.departmentId) parts.push(Prisma.sql`${col('department_id')} = ${src.departmentId}::uuid`);
    return Prisma.join(parts, ' AND ');
  }

  /**
   * Default: the last 30 UTC days including today. The span is checked AFTER the
   * defaults are applied, so `?from=1971-01-01` alone cannot ask for decades.
   * The personal dashboard (live rows) is clamped to its last 90 days.
   */
  private range(q: AnalyticsQuery, maxDays = ANALYTICS_MAX_RANGE_DAYS): Range {
    const today = new Date().toISOString().slice(0, 10);
    const to = q.to ?? today;
    let from =
      q.from ?? new Date(Date.parse(to) - (ANALYTICS_DEFAULT_RANGE_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
    if (Date.parse(from) > Date.parse(to)) throw new ValidationException({ to: ['analytics.range_invalid'] });
    if (maxDays === OWN_DASHBOARD_MAX_DAYS) {
      const earliest = new Date(Date.parse(today) - (OWN_DASHBOARD_MAX_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
      if (from < earliest) from = earliest;
      if (to < earliest) throw new ValidationException({ to: ['analytics.range_invalid'] });
    }
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= ANALYTICS_MAX_RANGE_DAYS) {
      throw new ValidationException({ to: ['analytics.range_too_long'] });
    }
    return { from, to };
  }
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}
