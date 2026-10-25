import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuditEntryResponse, AuditQuery, AuditQueryResponse } from '@hares/contract';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

interface Row {
  id: string;
  ts: string;
  acting_admin_id: string;
  acting_admin_name: string;
  action_type: AuditEntryResponse['action_type'];
  target_type: AuditEntryResponse['target_type'];
  target_id: string | null;
  target_name: string | null;
  detail: AuditEntryResponse['detail'];
}

const invalidCursor = () => new BadRequestException({ code: 'INVALID_CURSOR', message: 'The cursor is not valid.' });

/**
 * Read side of the admin audit trail (WEB-FR-051). Read-only: the trail is
 * append-only (triggers + REVOKE), and this class has no write method.
 *
 * Keyset pagination on (created_at DESC, id DESC). created_at has microsecond
 * precision in PostgreSQL but a JavaScript Date only has milliseconds, so the
 * cursor carries the timestamp as TEXT produced by the database itself; a
 * round trip through a Date would drop digits and skip or repeat entries.
 */
@Injectable()
export class AuditQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(q: AuditQuery): Promise<AuditQueryResponse> {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q.action_type) parts.push(Prisma.sql`a.action_type = ${q.action_type}::audit_action_type`);
    if (q.target_type) parts.push(Prisma.sql`a.target_type = ${q.target_type}::target_type`);
    if (q.acting_admin_id) parts.push(Prisma.sql`a.acting_admin_id = ${q.acting_admin_id}::uuid`);
    if (q.from) parts.push(Prisma.sql`a.created_at >= ${q.from}::timestamptz`);
    if (q.to) parts.push(Prisma.sql`a.created_at < ${q.to}::timestamptz`);
    if (q.cursor) {
      const c = decodeCursor(q.cursor);
      parts.push(Prisma.sql`(a.created_at, a.id) < (${c.ts}::timestamptz, ${c.id}::uuid)`);
    }

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT a.id,
             to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ts,
             a.acting_admin_id, admin.full_name AS acting_admin_name,
             a.action_type::text AS action_type, a.target_type::text AS target_type, a.target_id,
             COALESCE(tu.full_name, td.name, tr.name) AS target_name, a.detail
        FROM "AdminAuditLog" a
        JOIN "User" admin ON admin.id = a.acting_admin_id
        LEFT JOIN "User" tu ON a.target_type = 'USER' AND tu.id = a.target_id
        LEFT JOIN "Department" td ON a.target_type = 'DEPARTMENT' AND td.id = a.target_id
        LEFT JOIN "CustomRule" tr ON a.target_type = 'CUSTOM_RULE' AND tr.id = a.target_id
       WHERE ${Prisma.join(parts, ' AND ')}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${q.page_size + 1}`);

    const page = rows.slice(0, q.page_size);
    return {
      items: page.map((r) => ({
        id: r.id,
        created_at: r.ts,
        acting_admin_id: r.acting_admin_id,
        acting_admin_name: r.acting_admin_name,
        action_type: r.action_type,
        target_type: r.target_type,
        target_id: r.target_id,
        target_name: r.target_name,
        detail: r.detail,
      })),
      next_cursor: rows.length > q.page_size ? encodeCursor(page[page.length - 1]) : null,
    };
  }
}

function encodeCursor(r: Pick<Row, 'ts' | 'id'>): string {
  return Buffer.from(JSON.stringify([r.ts, r.id])).toString('base64url');
}

function decodeCursor(cursor: string): { ts: string; id: string } {
  try {
    const [ts, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as [string, string];
    const validTime =
      typeof ts === 'string' &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(ts) &&
      !Number.isNaN(Date.parse(ts.replace(/(\.\d{3})\d{3}Z$/, '$1Z')));
    const validId = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!validTime || !validId) throw new Error('bad');
    return { ts, id };
  } catch {
    throw invalidCursor();
  }
}
