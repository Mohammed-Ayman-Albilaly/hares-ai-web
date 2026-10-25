import { z } from 'zod';

/**
 * Admin audit trail (batch B4d; decisions 11 and 19). The trail is append-only
 * and never deleted. Each entry: acting admin, action, target, timestamp and
 * non-sensitive detail. The query endpoint arrives in B8.
 */

export const AUDIT_ACTIONS = [
  'USER_APPROVED',
  'USER_REJECTED',
  'USER_REOPENED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'USER_ROLE_CHANGED',
  'USER_DEPARTMENT_CHANGED',
  'SYSTEM_ADMIN_GRANTED',
  'SYSTEM_ADMIN_REVOKED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_RENAMED',
  'DEPARTMENT_DEACTIVATED',
  'POLICY_CHANGED',
  'RULE_CHANGED',
] as const;
export const AuditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AUDIT_TARGET_TYPES = ['USER', 'DEPARTMENT', 'CUSTOM_RULE', 'POLICY'] as const;
export const AuditTargetTypeSchema = z.enum(AUDIT_TARGET_TYPES);
export type AuditTargetType = z.infer<typeof AuditTargetTypeSchema>;

/** A detail value is a short scalar: never free text from users, never secrets. */
const DetailValueSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(100)).max(30),
]);

/** Upper bound for one serialized detail object. */
export const AUDIT_DETAIL_MAX_BYTES = 4096;

/**
 * Non-sensitive detail (decision 19): ids, enum values, old/new names. Keys
 * are snake_case. It must never contain passwords, tokens, hashes, prompt
 * text or a custom-rule definition.
 */
export const AuditDetailSchema = z
  .record(z.string().regex(/^[a-z][a-z0-9_]{0,40}$/), DetailValueSchema)
  .refine((d) => Object.keys(d).length <= 20, 'audit.detail_too_large')
  .refine((d) => new TextEncoder().encode(JSON.stringify(d)).length <= AUDIT_DETAIL_MAX_BYTES, 'audit.detail_too_large');
export type AuditDetail = z.infer<typeof AuditDetailSchema>;

/** Internal input for the audit write helper (not an HTTP body). */
export const AuditEntryInputSchema = z
  .object({
    acting_admin_id: z.string().uuid(),
    action: AuditActionSchema,
    target_type: AuditTargetTypeSchema,
    /** Null only for POLICY changes that have no single target row. */
    target_id: z.string().uuid().nullable(),
    detail: AuditDetailSchema.optional(),
  })
  .refine((e) => e.target_type === 'POLICY' || e.target_id !== null, {
    message: 'audit.target_required',
    path: ['target_id'],
  });
export type AuditEntryInput = z.infer<typeof AuditEntryInputSchema>;
