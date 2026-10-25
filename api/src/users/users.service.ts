import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminUserResponse,
  ApproveUserRequest,
  AssignableRole,
  ProfileResponse,
  PendingListQuery,
  Role,
  UserListQuery,
  UserListResponse,
  UserStatus,
} from '@hares/contract';
import { AuditService, type AuditTx } from '../audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import type { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

/** The target row, locked FOR UPDATE for the whole transaction. */
interface Target {
  id: string;
  status: UserStatus;
  role: Role | null;
  departmentId: string | null;
}

const USER_ROW = {
  id: true,
  fullName: true,
  email: true,
  status: true,
  role: true,
  departmentId: true,
  registeredAt: true,
  approvedAt: true,
  department: { select: { name: true } },
} as const;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_ROW }>;

const SYSTEM_ADMIN_LOCK = 'lock:system-admins';

const userNotFound = () => new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
const invalidState = (message: string) => new ConflictException({ code: 'INVALID_USER_STATE', message });
const selfDenied = () =>
  new ForbiddenException({ code: 'CANNOT_MODIFY_SELF', message: 'You cannot do this to your own account.' });
const outOfScope = () =>
  new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission for this user.' });
const deptNotFound = () => new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.' });
const deptInactive = () =>
  new ConflictException({ code: 'DEPARTMENT_INACTIVE', message: 'The department is not active.' });

function toResponse(u: UserRow): AdminUserResponse {
  return {
    id: u.id,
    full_name: u.fullName,
    email: u.email,
    status: u.status,
    role: u.role,
    department_id: u.departmentId,
    department_name: u.department?.name ?? null,
    registered_at: u.registeredAt.toISOString(),
    approved_at: u.approvedAt?.toISOString() ?? null,
  };
}

/**
 * Admin user lifecycle (WEB-FR-009..017, 053, 057, 060, 061, 063; decisions 3,
 * 4, 14, 17, 20, 24).
 *
 * Every mutation:
 *  - runs in one transaction that locks the target row (FOR UPDATE), checks
 *    the rules, changes status / role / department in ONE UPDATE statement
 *    (so the table's CHECK constraints always see a consistent row), and
 *    writes its audit entry in the same transaction;
 *  - re-checks the hard rules here (self-protection, Department Admin scope
 *    and role hierarchy), not only in the RolesGuard.
 * Deactivate and reject bump token_version and revoke the refresh families in
 * the same transaction, so access and refresh tokens die immediately.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------- reads ----------

  async profile(userId: string): Promise<ProfileResponse> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_ROW });
    if (!u) throw userNotFound();
    return {
      id: u.id,
      full_name: u.fullName,
      email: u.email,
      status: u.status,
      role: u.role,
      department: u.departmentId && u.department ? { id: u.departmentId, name: u.department.name } : null,
    };
  }

  /** Scope comes from the guard-loaded user row: a Department Admin only sees their department. */
  async list(actor: AuthUser, q: UserListQuery): Promise<UserListResponse> {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.q
        ? {
            OR: [
              { fullName: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (actor.role === 'DEPARTMENT_ADMIN') {
      where.departmentId = actor.departmentId ?? '00000000-0000-0000-0000-000000000000';
    } else if (q.department_id) {
      where.departmentId = q.department_id;
    }
    return this.page(where, q, { registeredAt: 'desc' });
  }

  /** WEB-FR-009: PENDING accounts, oldest first. */
  pending(q: PendingListQuery): Promise<UserListResponse> {
    return this.page({ status: 'PENDING' }, q, { registeredAt: 'asc' });
  }

  private async page(
    where: Prisma.UserWhereInput,
    q: Pick<UserListQuery, 'page' | 'page_size'>,
    orderBy: Prisma.UserOrderByWithRelationInput,
  ): Promise<UserListResponse> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (q.page - 1) * q.page_size,
        take: q.page_size,
        select: USER_ROW,
      }),
    ]);
    return { items: rows.map(toResponse), page: q.page, page_size: q.page_size, total };
  }

  // ---------- transitions ----------

  /** WEB-FR-010: PENDING -> ACTIVE with department and role, in one UPDATE. */
  approve(actor: AuthUser, id: string, input: ApproveUserRequest): Promise<AdminUserResponse> {
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'PENDING') throw invalidState('Only a pending account can be approved.');
      await this.requireActiveDepartment(tx, input.department_id);
      await tx.user.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          role: input.role,
          departmentId: input.department_id,
          approvedBy: actor.id,
          approvedAt: new Date(),
        },
      });
      await this.record(tx, actor, 'USER_APPROVED', id, { role: input.role, department_id: input.department_id });
    });
  }

  /** WEB-FR-011: PENDING -> REJECTED (terminal, decision 24). */
  reject(actor: AuthUser, id: string): Promise<AdminUserResponse> {
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'PENDING') throw invalidState('Only a pending account can be rejected.');
      await tx.user.update({ where: { id }, data: { status: 'REJECTED', tokenVersion: { increment: 1 } } });
      await this.record(tx, actor, 'USER_REJECTED', id);
    });
  }

  /** Decision 24: a System Admin may re-open a REJECTED account to PENDING. */
  reopen(actor: AuthUser, id: string): Promise<AdminUserResponse> {
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'REJECTED') throw invalidState('Only a rejected account can be re-opened.');
      await tx.user.update({ where: { id }, data: { status: 'PENDING' } });
      await this.record(tx, actor, 'USER_REOPENED', id);
    });
  }

  /**
   * WEB-FR-014/015/061/063. System Admin: any ACTIVE user except themselves.
   * Department Admin: only plain USERs of their own department.
   */
  deactivate(actor: AuthUser, id: string): Promise<AdminUserResponse> {
    if (actor.id === id) throw selfDenied();
    return this.mutate(
      id,
      async (tx, t) => {
        if (actor.role === 'DEPARTMENT_ADMIN') {
          if (t.departmentId === null || t.departmentId !== actor.departmentId || t.role !== 'USER') {
            throw outOfScope();
          }
        }
        if (t.status !== 'ACTIVE') throw invalidState('Only an active account can be deactivated.');
        await tx.user.update({ where: { id }, data: { status: 'DEACTIVATED', tokenVersion: { increment: 1 } } });
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await this.record(tx, actor, 'USER_DEACTIVATED', id);
      },
      { lockSystemAdmins: true, actor },
    );
  }

  /** WEB-FR-053: DEACTIVATED -> ACTIVE. The role is kept; the department must be active. */
  reactivate(actor: AuthUser, id: string, departmentId?: string): Promise<AdminUserResponse> {
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'DEACTIVATED') throw invalidState('Only a deactivated account can be reactivated.');
      let nextDepartment = t.departmentId;
      if (t.role !== 'SYSTEM_ADMIN') {
        nextDepartment = departmentId ?? t.departmentId;
        if (!nextDepartment) throw deptNotFound();
        await this.requireActiveDepartment(tx, nextDepartment);
      }
      await tx.user.update({ where: { id }, data: { status: 'ACTIVE', departmentId: nextDepartment } });
      await this.record(
        tx,
        actor,
        'USER_REACTIVATED',
        id,
        nextDepartment ? { department_id: nextDepartment, old_department_id: t.departmentId } : undefined,
      );
    });
  }

  /** WEB-FR-017: DEPARTMENT_ADMIN <-> USER. SYSTEM_ADMIN is only granted/revoked separately. */
  changeRole(actor: AuthUser, id: string, role: AssignableRole): Promise<AdminUserResponse> {
    if (actor.id === id) throw selfDenied();
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'ACTIVE') throw invalidState('Only an active account can change role.');
      if (t.role === 'SYSTEM_ADMIN') throw invalidState('Use revoke-system-admin for a System Admin.');
      if (t.role === role) return false;
      await tx.user.update({ where: { id }, data: { role } });
      await this.record(tx, actor, 'USER_ROLE_CHANGED', id, { old_role: t.role, new_role: role });
    });
  }

  /** WEB-FR-016: move an ACTIVE user to another ACTIVE department. */
  changeDepartment(actor: AuthUser, id: string, departmentId: string): Promise<AdminUserResponse> {
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'ACTIVE') throw invalidState('Only an active account can change department.');
      if (t.role === 'SYSTEM_ADMIN') throw invalidState('A System Admin has no department.');
      if (t.departmentId === departmentId) return false;
      await this.requireActiveDepartment(tx, departmentId);
      await tx.user.update({ where: { id }, data: { departmentId } });
      await this.record(tx, actor, 'USER_DEPARTMENT_CHANGED', id, {
        old_department_id: t.departmentId,
        new_department_id: departmentId,
      });
    });
  }

  /** WEB-FR-060: an ACTIVE non-admin becomes SYSTEM_ADMIN with no department (WEB-FR-064). */
  grantSystemAdmin(actor: AuthUser, id: string): Promise<AdminUserResponse> {
    return this.mutate(id, async (tx, t) => {
      if (t.status !== 'ACTIVE') throw invalidState('Only an active account can become System Admin.');
      if (t.role === 'SYSTEM_ADMIN') throw invalidState('The user is already a System Admin.');
      await tx.user.update({ where: { id }, data: { role: 'SYSTEM_ADMIN', departmentId: null } });
      await this.record(tx, actor, 'SYSTEM_ADMIN_GRANTED', id, {
        previous_role: t.role,
        previous_department_id: t.departmentId,
      });
    });
  }

  /** WEB-FR-060/061: the revoking admin picks the new role and an ACTIVE department; never on self. */
  revokeSystemAdmin(actor: AuthUser, id: string, role: AssignableRole, departmentId: string): Promise<AdminUserResponse> {
    if (actor.id === id) throw selfDenied();
    return this.mutate(
      id,
      async (tx, t) => {
        if (t.status !== 'ACTIVE' || t.role !== 'SYSTEM_ADMIN') {
          throw invalidState('The user is not an active System Admin.');
        }
        await this.requireActiveDepartment(tx, departmentId);
        await tx.user.update({ where: { id }, data: { role, departmentId } });
        await this.record(tx, actor, 'SYSTEM_ADMIN_REVOKED', id, { new_role: role, department_id: departmentId });
      },
      { lockSystemAdmins: true, actor },
    );
  }

  // ---------- helpers ----------

  /**
   * Run `fn` in a transaction with the target row locked. `fn` returns false
   * for a no-op (nothing written). Returns the fresh admin view of the user.
   */
  private async mutate(
    id: string,
    fn: (tx: AuditTx, target: Target) => Promise<void | false>,
    opts: { lockSystemAdmins?: boolean; actor?: AuthUser } = {},
  ): Promise<AdminUserResponse> {
    await this.prisma.$transaction(async (tx) => {
      if (opts.lockSystemAdmins && opts.actor) await this.assertActorStillSystemAdminOrScoped(tx, opts.actor);
      const rows = await tx.$queryRaw<
        { id: string; status: UserStatus; role: Role | null; department_id: string | null }[]
      >`SELECT id, status::text AS status, role::text AS role, department_id
          FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw userNotFound();
      await fn(tx, { id: row.id, status: row.status, role: row.role, departmentId: row.department_id });
    });
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: USER_ROW });
    return toResponse(u);
  }

  /**
   * Two System Admins deactivating/demoting each other at the same moment must
   * not leave the system without an admin: take a global advisory lock, then
   * re-read the acting admin inside it. The second request sees the first one's
   * effect and is refused.
   */
  private async assertActorStillSystemAdminOrScoped(tx: AuditTx, actor: AuthUser): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${SYSTEM_ADMIN_LOCK}))) AS l`;
    const me = await tx.user.findUnique({
      where: { id: actor.id },
      select: { status: true, role: true, departmentId: true },
    });
    // Re-read inside the lock: the guard-loaded role/department may be stale.
    if (!me || me.status !== 'ACTIVE' || me.role !== actor.role || me.departmentId !== actor.departmentId) {
      throw outOfScope();
    }
  }

  /** The department must exist and be active; FOR SHARE blocks a concurrent deactivation. */
  private async requireActiveDepartment(tx: AuditTx, departmentId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ active: boolean }[]>`
      SELECT active FROM "Department" WHERE id = ${departmentId}::uuid FOR SHARE`;
    if (rows.length === 0) throw deptNotFound();
    if (!rows[0].active) throw deptInactive();
  }

  private record(
    tx: AuditTx,
    actor: AuthUser,
    action: Parameters<AuditService['recordIn']>[1]['action'],
    targetId: string,
    detail?: Record<string, string | null>,
  ): Promise<void> {
    return this.audit.recordIn(tx, {
      acting_admin_id: actor.id,
      action,
      target_type: 'USER',
      target_id: targetId,
      ...(detail ? { detail } : {}),
    });
  }
}
