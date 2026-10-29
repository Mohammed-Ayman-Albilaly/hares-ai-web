import { z } from 'zod';
import type { Role } from './enums';

/**
 * Capability matrix (SPEC-WEB §2 "Permission matrix", decisions 4, 14, 17).
 * Batch B5a. One row per web capability; the extension capabilities (bundle
 * fetch, ingestion) are guarded by the extension token type instead.
 *
 *   ALLOW  — allowed for the whole organisation
 *   SCOPED — allowed, limited to the caller's own department (or own data)
 *   DENY   — refused with 403 (✗ and — in the SPEC table)
 */
export const CAPABILITIES = [
  'PROFILE_VIEW', // view own profile / change own password
  'OWN_DASHBOARD_VIEW', // own dashboard
  'OWN_LOGS_VIEW', // own activity log / blocked messages
  'DEPT_DASHBOARD_VIEW', // department dashboard & logs
  'ORG_DASHBOARD_VIEW', // org-wide dashboard & logs
  'LOGS_EXPORT', // CSV export
  'USERS_LIST', // list users
  'USERS_APPROVE', // approve / reject / re-open pending users
  'USERS_ASSIGN', // assign role / change department
  'USERS_DEACTIVATE', // deactivate a user
  'USERS_REACTIVATE', // reactivate a user
  'SYSTEM_ADMIN_GRANT', // grant / revoke SYSTEM_ADMIN
  'DEPARTMENTS_MANAGE', // list, create, rename, deactivate departments
  'RULES_VIEW', // view custom detection rules
  'RULES_MANAGE', // create / edit custom detection rules (Department Admin: own department only)
  'POLICY_VIEW', // view org / department policy
  'POLICY_MANAGE', // edit a department's policy (Department Admin: own department)
  'ORG_POLICY_MANAGE', // edit the organisation-wide policy
  'AUDIT_VIEW', // view the admin audit trail
] as const;
export const CapabilitySchema = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof CapabilitySchema>;

export const GRANTS = ['ALLOW', 'SCOPED', 'DENY'] as const;
export const GrantSchema = z.enum(GRANTS);
export type Grant = z.infer<typeof GrantSchema>;

type Row = Record<Role, Grant>;
const row = (USER: Grant, DEPARTMENT_ADMIN: Grant, SYSTEM_ADMIN: Grant): Row => ({
  USER,
  DEPARTMENT_ADMIN,
  SYSTEM_ADMIN,
});

/** The single source of truth for role checks (API guard, web route guards, tests). */
export const CAPABILITY_MATRIX: Record<Capability, Row> = {
  //                             USER      DEPT_ADMIN SYSTEM_ADMIN
  PROFILE_VIEW: row('SCOPED', 'SCOPED', 'SCOPED'),
  OWN_DASHBOARD_VIEW: row('SCOPED', 'SCOPED', 'SCOPED'),
  OWN_LOGS_VIEW: row('SCOPED', 'SCOPED', 'SCOPED'),
  DEPT_DASHBOARD_VIEW: row('DENY', 'SCOPED', 'ALLOW'),
  ORG_DASHBOARD_VIEW: row('DENY', 'DENY', 'ALLOW'),
  LOGS_EXPORT: row('DENY', 'SCOPED', 'ALLOW'),
  USERS_LIST: row('DENY', 'SCOPED', 'ALLOW'),
  USERS_APPROVE: row('DENY', 'DENY', 'ALLOW'),
  USERS_ASSIGN: row('DENY', 'DENY', 'ALLOW'),
  USERS_DEACTIVATE: row('DENY', 'SCOPED', 'ALLOW'),
  USERS_REACTIVATE: row('DENY', 'DENY', 'ALLOW'),
  SYSTEM_ADMIN_GRANT: row('DENY', 'DENY', 'ALLOW'),
  DEPARTMENTS_MANAGE: row('DENY', 'DENY', 'ALLOW'),
  RULES_VIEW: row('DENY', 'SCOPED', 'ALLOW'),
  RULES_MANAGE: row('DENY', 'SCOPED', 'ALLOW'),
  POLICY_VIEW: row('DENY', 'SCOPED', 'ALLOW'),
  POLICY_MANAGE: row('DENY', 'SCOPED', 'ALLOW'),
  ORG_POLICY_MANAGE: row('DENY', 'DENY', 'ALLOW'),
  AUDIT_VIEW: row('DENY', 'DENY', 'ALLOW'),
};

/**
 * Capabilities whose SCOPED grant means "the caller's own data". Every other
 * SCOPED capability means "the caller's own department", which needs a
 * department on the caller (see RolesGuard).
 */
export const OWN_DATA_CAPABILITIES: readonly Capability[] = ['PROFILE_VIEW', 'OWN_DASHBOARD_VIEW', 'OWN_LOGS_VIEW'];

/** The grant a role has for a capability (null role = no access at all). */
export function grantFor(capability: Capability, role: Role | null): Grant {
  return role ? CAPABILITY_MATRIX[capability][role] : 'DENY';
}
