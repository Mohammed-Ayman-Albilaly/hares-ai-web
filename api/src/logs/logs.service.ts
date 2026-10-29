import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CSV_COLUMNS,
  CSV_EXPORT_MAX_ROWS,
  type LogDetail,
  type LogExportQuery,
  type LogListItem,
  type LogListResponse,
  type LogQuery,
  type OwnLogQuery,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { csvRow } from './csv';

type Filters = Pick<
  LogQuery,
  'from' | 'to' | 'risk_level' | 'platform' | 'action' | 'user_decision' | 'category' | 'rule_id' | 'user_id' | 'department_id'
>;

/** Who is asking and what they may see. Built from the guard-loaded user row. */
interface Scope {
  /** Restrict to one user (own events). */
  userId?: string;
  /** Restrict to one department (Department Admin). `null` = no department filter. */
  departmentId?: string | null;
}

interface Row {
  log_id: string;
  event_time: Date;
  /** event_time as text with microseconds, straight from the database (keyset cursor). */
  event_time_cursor: string;
  received_at: Date;
  user_id: string;
  user_name: string;
  user_email: string;
  department_id: string | null;
  department_name: string | null;
  platform: LogListItem['platform'];
  risk_level: LogListItem['risk_level'];
  action: LogListItem['action'];
  user_decision: LogListItem['user_decision'];
  classification_source: LogDetail['classification_source'];
  rule_id: string | null;
  rule_name: string | null;
  schema_version: number;
  categories: LogListItem['categories'];
}

const EXPORT_CHUNK = 1000;

const SELECT = Prisma.sql`
  SELECT l.log_id, l.event_time,
         to_char(l.event_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS event_time_cursor,
         l.received_at, l.user_id, u.full_name AS user_name, u.email AS user_email,
         l.department_id, d.name AS department_name, l.platform::text AS platform, l.risk_level::text AS risk_level,
         l.action::text AS action, l.user_decision::text AS user_decision,
         l.classification_source::text AS classification_source, l.rule_id, cr.name AS rule_name, l.schema_version,
         COALESCE((SELECT array_agg(lc.category_code ORDER BY lc.category_code)
                     FROM "LogCategory" lc WHERE lc.log_id = l.log_id), ARRAY[]::text[]) AS categories
    FROM "ActivityLog" l
    JOIN "User" u ON u.id = l.user_id
    LEFT JOIN "Department" d ON d.id = l.department_id
    LEFT JOIN "CustomRule" cr ON cr.id = l.rule_id`;

function toItem(r: Row): LogListItem {
  return {
    log_id: r.log_id,
    event_time: r.event_time.toISOString(),
    user_id: r.user_id,
    user_name: r.user_name,
    department_id: r.department_id,
    department_name: r.department_name,
    platform: r.platform,
    risk_level: r.risk_level,
    action: r.action,
    user_decision: r.user_decision,
    categories: r.categories,
    rule_name: r.rule_name,
  };
}

const invalidCursor = () => new BadRequestException({ code: 'INVALID_CURSOR', message: 'The cursor is not valid.' });

// The cursor holds the timestamp as TEXT from the database: a JavaScript Date
// has milliseconds only, PostgreSQL stores microseconds, and a rounded cursor
// would skip or repeat rows.
const CURSOR_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(r: Pick<Row, 'event_time_cursor' | 'log_id'>): string {
  return Buffer.from(JSON.stringify([r.event_time_cursor, r.log_id])).toString('base64url');
}

function decodeCursor(cursor: string): { time: string; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error('bad');
    const [time, id] = parsed as [unknown, unknown];
    if (typeof time !== 'string' || typeof id !== 'string' || !CURSOR_TIME.test(time) || !UUID.test(id)) {
      throw new Error('bad');
    }
    return { time, id };
  } catch {
    throw invalidCursor();
  }
}

/**
 * Scoped log review, filters and CSV export (WEB-FR-021..027, 066; decision 16).
 *
 * Scope is applied in SQL from the guard-loaded user row (never from the
 * request): a User sees only their own events, a Department Admin only their
 * department, a System Admin everything (with optional filters). A log outside
 * the caller's scope is "not found", so ids reveal nothing (IDOR).
 *
 * Reads use keyset pagination on (event_time DESC, log_id DESC) with a
 * row-value comparison, which Prisma cannot express, hence raw SQL. Only
 * metadata columns exist in the table, so no prompt text can appear.
 */
@Injectable()
export class LogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The caller's own events (WEB-FR-023); `action=BLOCKED` gives "Blocked Messages" (WEB-FR-032). */
  own(actor: AuthUser, q: OwnLogQuery): Promise<LogListResponse> {
    return this.page({ userId: actor.id }, q, q);
  }

  /** WEB-FR-021/022/024. A Department Admin is pinned to their own department. */
  admin(actor: AuthUser, q: LogQuery): Promise<LogListResponse> {
    return this.page(this.adminScope(actor), q, q);
  }

  async detail(actor: AuthUser, logId: string): Promise<LogDetail> {
    const rows = await this.prisma.$queryRaw<Row[]>(
      Prisma.sql`${SELECT} WHERE l.log_id = ${logId}::uuid AND ${this.scopeSql(this.adminScope(actor))}`,
    );
    if (rows.length === 0) throw new NotFoundException({ code: 'LOG_NOT_FOUND', message: 'Log not found.' });
    const r = rows[0];
    return {
      ...toItem(r),
      user_email: r.user_email,
      classification_source: r.classification_source,
      rule_id: r.rule_id,
      schema_version: r.schema_version,
      received_at: r.received_at.toISOString(),
    };
  }

  /**
   * WEB-FR-025: stream the filtered rows as CSV, in chunks of 1000 by keyset,
   * so memory stays flat. `write` returns a promise that resolves when the
   * consumer can take more (backpressure); `isClosed` stops the export early
   * when the client disconnects.
   */
  async exportCsv(
    actor: AuthUser,
    q: LogExportQuery,
    write: (chunk: string) => Promise<void>,
    isClosed: () => boolean,
  ): Promise<number> {
    const scope = this.adminScope(actor);
    let written = 0;
    let headerWritten = false;
    let after: { time: string; id: string } | undefined;
    while (written < CSV_EXPORT_MAX_ROWS && !isClosed()) {
      const limit = Math.min(EXPORT_CHUNK, CSV_EXPORT_MAX_ROWS - written);
      // The first query runs BEFORE anything is written, so a database error
      // can still become a normal JSON error response.
      const rows = await this.query(scope, q, after, limit);
      if (!headerWritten) {
        headerWritten = true;
        await write(csvRow([...CSV_COLUMNS]));
      }
      if (rows.length === 0) break;
      await write(
        rows
          .map((r) =>
            csvRow([
              r.log_id,
              r.event_time.toISOString(),
              r.user_name,
              r.user_email,
              r.department_name,
              r.platform,
              r.risk_level,
              r.action,
              r.user_decision,
              r.categories.join(';'),
              r.classification_source,
              r.rule_id,
            ]),
          )
          .join(''),
      );
      written += rows.length;
      const last = rows[rows.length - 1];
      after = { time: last.event_time_cursor, id: last.log_id };
      if (rows.length < limit) break;
    }
    if (!headerWritten) await write(csvRow([...CSV_COLUMNS]));
    return written;
  }

  // ---------- internals ----------

  private adminScope(actor: AuthUser): Scope {
    return actor.role === 'DEPARTMENT_ADMIN'
      ? // A Department Admin without a department matches nothing (the guard also refuses them).
        { departmentId: actor.departmentId ?? '00000000-0000-0000-0000-000000000000' }
      : { departmentId: null };
  }

  private async page(scope: Scope, f: Filters, p: { cursor?: string; page_size: number }): Promise<LogListResponse> {
    const after = p.cursor ? decodeCursor(p.cursor) : undefined;
    const rows = await this.query(scope, f, after, p.page_size + 1);
    const items = rows.slice(0, p.page_size);
    const hasMore = rows.length > p.page_size;
    return {
      items: items.map(toItem),
      next_cursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  private query(scope: Scope, f: Filters, after: { time: string; id: string } | undefined, limit: number): Promise<Row[]> {
    const cursor = after
      ? Prisma.sql`AND (l.event_time, l.log_id) < (${after.time}::timestamptz, ${after.id}::uuid)`
      : Prisma.empty;
    return this.prisma.$queryRaw<Row[]>(
      Prisma.sql`${SELECT}
        WHERE ${this.scopeSql(scope)} ${this.filterSql(scope, f)} ${cursor}
        ORDER BY l.event_time DESC, l.log_id DESC
        LIMIT ${limit}`,
    );
  }

  private scopeSql(scope: Scope): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (scope.userId) parts.push(Prisma.sql`l.user_id = ${scope.userId}::uuid`);
    if (scope.departmentId) parts.push(Prisma.sql`l.department_id = ${scope.departmentId}::uuid`);
    return Prisma.join(parts, ' AND ');
  }

  private filterSql(scope: Scope, f: Filters): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (f.from) parts.push(Prisma.sql`l.event_time >= ${f.from}::timestamptz`);
    if (f.to) parts.push(Prisma.sql`l.event_time < ${f.to}::timestamptz`);
    if (f.risk_level) parts.push(Prisma.sql`l.risk_level = ${f.risk_level}::risk_level`);
    if (f.platform) parts.push(Prisma.sql`l.platform = ${f.platform}::platform`);
    if (f.action) parts.push(Prisma.sql`l.action = ${f.action}::log_action`);
    if (f.user_decision) parts.push(Prisma.sql`l.user_decision = ${f.user_decision}::user_decision`);
    if (f.rule_id) parts.push(Prisma.sql`l.rule_id = ${f.rule_id}::uuid`);
    if (f.category) {
      parts.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "LogCategory" c WHERE c.log_id = l.log_id AND c.category_code = ${f.category})`,
      );
    }
    // user_id / department_id filters narrow further; they can never widen the scope.
    if (f.user_id && !scope.userId) parts.push(Prisma.sql`l.user_id = ${f.user_id}::uuid`);
    if (f.department_id && !scope.departmentId) parts.push(Prisma.sql`l.department_id = ${f.department_id}::uuid`);
    return parts.length === 0 ? Prisma.empty : Prisma.sql`AND ${Prisma.join(parts, ' AND ')}`;
  }
}
