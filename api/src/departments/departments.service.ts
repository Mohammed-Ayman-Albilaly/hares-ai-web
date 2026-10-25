import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DepartmentResponse } from '@hares/contract';
import { AuditService } from '../audit/audit.service';
import { isUniqueViolation } from '../common/db-errors';
import { PrismaService } from '../prisma/prisma.service';

const nameTaken = () =>
  new ConflictException({ code: 'DEPARTMENT_NAME_TAKEN', message: 'A department with this name already exists.' });
const notFound = () => new NotFoundException({ code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.' });

/**
 * Department lifecycle (WEB-FR-019, 054-056; decisions 14, 18, 23). Only the
 * System Admin reaches these methods (RolesGuard: DEPARTMENTS_MANAGE). Every
 * write records its audit entry in the same transaction.
 *
 * Departments are never deleted: deactivation keeps the history, blocks log
 * ingestion for the department's users (IngestionModule checks
 * `isActive`), and leaves the logs visible until the 90-day purge.
 */
@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<DepartmentResponse[]> {
    const rows = await this.prisma.department.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, active: true, _count: { select: { users: true } } },
    });
    return rows.map((d) => ({ id: d.id, name: d.name, active: d.active, member_count: d._count.users }));
  }

  async get(id: string): Promise<DepartmentResponse> {
    const d = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, active: true, _count: { select: { users: true } } },
    });
    if (!d) throw notFound();
    return { id: d.id, name: d.name, active: d.active, member_count: d._count.users };
  }

  async create(actorId: string, name: string): Promise<DepartmentResponse> {
    const id = randomUUID();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.department.create({ data: { id, name, active: true } });
        await this.audit.recordIn(tx, {
          acting_admin_id: actorId,
          action: 'DEPARTMENT_CREATED',
          target_type: 'DEPARTMENT',
          target_id: id,
          detail: { name },
        });
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw nameTaken();
      throw e;
    }
    return this.get(id);
  }

  async rename(actorId: string, id: string, name: string): Promise<DepartmentResponse> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.department.findUnique({ where: { id }, select: { name: true } });
        if (!current) throw notFound();
        if (current.name === name) return;
        await tx.department.update({ where: { id }, data: { name } });
        await this.audit.recordIn(tx, {
          acting_admin_id: actorId,
          action: 'DEPARTMENT_RENAMED',
          target_type: 'DEPARTMENT',
          target_id: id,
          detail: { old_name: current.name, new_name: name },
        });
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw nameTaken();
      throw e;
    }
    return this.get(id);
  }

  async deactivate(actorId: string, id: string): Promise<DepartmentResponse> {
    await this.prisma.$transaction(async (tx) => {
      // Conditional update: only an active department changes (no double audit).
      const changed = await tx.department.updateMany({ where: { id, active: true }, data: { active: false } });
      if (changed.count === 0) {
        const exists = await tx.department.count({ where: { id } });
        if (!exists) throw notFound();
        throw new ConflictException({ code: 'DEPARTMENT_INACTIVE', message: 'The department is already inactive.' });
      }
      await this.audit.recordIn(tx, {
        acting_admin_id: actorId,
        action: 'DEPARTMENT_DEACTIVATED',
        target_type: 'DEPARTMENT',
        target_id: id,
      });
    });
    return this.get(id);
  }

  /** Used by ingestion: a deactivated department blocks its users' events (WEB-FR-056). */
  async isActive(id: string): Promise<boolean> {
    const d = await this.prisma.department.findUnique({ where: { id }, select: { active: true } });
    return d?.active === true;
  }
}
