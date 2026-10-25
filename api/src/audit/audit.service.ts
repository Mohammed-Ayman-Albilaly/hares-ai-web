import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditEntryInputSchema, type AuditEntryInput } from '@hares/contract';
import type { AuditAction, AuditTargetType } from '@hares/contract';
import type { $Enums, Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

/** A Prisma interactive-transaction client. */
export type AuditTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/** Keys that must never appear in an audit detail. */
const FORBIDDEN_DETAIL_KEY =
  /password|passwd|hash|token|secret|prompt|definition|key|credential|jwt|cookie|otp|session|example/i;

// Compile-time guard: the contract enums must equal the Prisma enums.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const ACTIONS_MATCH: Equal<AuditAction, $Enums.AuditActionType> = true;
const TARGETS_MATCH: Equal<AuditTargetType, $Enums.TargetType> = true;
void ACTIONS_MATCH;
void TARGETS_MATCH;

/**
 * Write-only access to the append-only admin audit trail (decisions 11, 19).
 *
 * There is deliberately no update or delete method: the database also blocks
 * them (triggers + REVOKE for the app role). Admin services call `recordIn`
 * with the same transaction client as the change itself, so the change and
 * its audit entry commit or roll back together.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Record an entry inside the caller's transaction. */
  async recordIn(tx: AuditTx, entry: AuditEntryInput): Promise<void> {
    const e = AuditEntryInputSchema.parse(entry);
    if (e.detail) assertSafeDetail(e.detail);
    await tx.adminAuditLog.create({
      data: {
        id: randomUUID(),
        actingAdminId: e.acting_admin_id,
        actionType: e.action,
        targetType: e.target_type,
        targetId: e.target_id,
        detail: (e.detail ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Record a standalone entry (its own transaction). */
  async record(entry: AuditEntryInput): Promise<void> {
    await this.prisma.$transaction((tx) => this.recordIn(tx, entry));
  }
}

function assertSafeDetail(detail: Record<string, unknown>): void {
  for (const key of Object.keys(detail)) {
    if (FORBIDDEN_DETAIL_KEY.test(key)) {
      throw new Error(`Audit detail key "${key}" is not allowed (sensitive).`);
    }
  }
}
