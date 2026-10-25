import { z } from 'zod';
import { RoleSchema, UserStatusSchema } from './enums';

/**
 * Admin user management and profile (batch B5b). All JSON fields are snake_case.
 *
 *   GET  /profile                                  -> ProfileResponse           (any signed-in user)
 *   GET  /admin/users?status&department_id&q&page  -> UserListResponse          (SA: all, DA: own department)
 *   GET  /admin/users/pending                      -> UserListResponse          (SA only)
 *   POST /admin/users/:id/approve   (department_id, role)   -> AdminUserResponse (SA)
 *   POST /admin/users/:id/reject                            -> AdminUserResponse (SA)
 *   POST /admin/users/:id/reopen                            -> AdminUserResponse (SA, REJECTED -> PENDING)
 *   POST /admin/users/:id/deactivate                        -> AdminUserResponse (SA any, DA own department users)
 *   POST /admin/users/:id/reactivate  ([department_id])     -> AdminUserResponse (SA)
 *   PATCH /admin/users/:id/role      (role)                 -> AdminUserResponse (SA)
 *   PATCH /admin/users/:id/department (department_id)      -> AdminUserResponse (SA)
 *   POST /admin/users/:id/grant-system-admin                -> AdminUserResponse (SA)
 *   POST /admin/users/:id/revoke-system-admin (role, department_id) -> AdminUserResponse (SA)
 */

/** Roles an admin may assign. SYSTEM_ADMIN only through grant-system-admin (WEB-FR-060). */
export const AssignableRoleSchema = z.enum(['DEPARTMENT_ADMIN', 'USER']);
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

export const AdminUserResponseSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string(),
  status: UserStatusSchema,
  role: RoleSchema.nullable(),
  department_id: z.string().uuid().nullable(),
  department_name: z.string().nullable(),
  registered_at: z.string().datetime(),
  approved_at: z.string().datetime().nullable(),
});
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;

export const USER_LIST_MAX_PAGE_SIZE = 100;

export const UserListQuerySchema = z
  .object({
    status: UserStatusSchema.optional(),
    department_id: z.string().uuid().optional(),
    role: RoleSchema.optional(),
    /** Case-insensitive match on name or email. */
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    page_size: z.coerce.number().int().min(1).max(USER_LIST_MAX_PAGE_SIZE).default(25),
  })
  .strict();
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

/** Pending approvals only paginate (no filters). */
export const PendingListQuerySchema = z
  .object({
    page: UserListQuerySchema.shape.page,
    page_size: UserListQuerySchema.shape.page_size,
  })
  .strict();
export type PendingListQuery = z.infer<typeof PendingListQuerySchema>;

export const UserListResponseSchema = z.object({
  items: z.array(AdminUserResponseSchema),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

export const ApproveUserRequestSchema = z
  .object({
    department_id: z.string().uuid(),
    role: AssignableRoleSchema,
  })
  .strict();
export type ApproveUserRequest = z.infer<typeof ApproveUserRequestSchema>;

/** Confirmation happens in the UI; these actions carry no fields. */
export const RejectUserRequestSchema = z.object({}).strict();
export type RejectUserRequest = z.infer<typeof RejectUserRequestSchema>;

/** Status-only transitions (reject, reopen, deactivate). */
export const UserStatusUpdateRequestSchema = z.object({}).strict();
export type UserStatusUpdateRequest = z.infer<typeof UserStatusUpdateRequestSchema>;

/** Reactivation keeps the user's role; a new department is needed only if theirs was deactivated. */
export const ReactivateUserRequestSchema = z.object({ department_id: z.string().uuid().optional() }).strict();
export type ReactivateUserRequest = z.infer<typeof ReactivateUserRequestSchema>;

export const AssignRoleRequestSchema = z.object({ role: AssignableRoleSchema }).strict();
export type AssignRoleRequest = z.infer<typeof AssignRoleRequestSchema>;

export const ChangeDepartmentRequestSchema = z.object({ department_id: z.string().uuid() }).strict();
export type ChangeDepartmentRequest = z.infer<typeof ChangeDepartmentRequestSchema>;

/** The revoking admin chooses the new role and an ACTIVE department (WEB-FR-060). */
export const RevokeSystemAdminRequestSchema = z
  .object({
    role: AssignableRoleSchema,
    department_id: z.string().uuid(),
  })
  .strict();
export type RevokeSystemAdminRequest = z.infer<typeof RevokeSystemAdminRequestSchema>;

export const ProfileResponseSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string(),
  status: UserStatusSchema,
  role: RoleSchema.nullable(),
  department: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

export const USER_ERROR_CODES = [
  'USER_NOT_FOUND', // 404
  'INVALID_USER_STATE', // 409 the action does not apply to the user's current status/role
  'CANNOT_MODIFY_SELF', // 403 nobody deactivates or demotes their own account (WEB-FR-061)
  'FORBIDDEN', // 403 target outside the caller's scope or role hierarchy (WEB-FR-015, 063)
] as const;
export const UserErrorCodeSchema = z.enum(USER_ERROR_CODES);
export type UserErrorCode = z.infer<typeof UserErrorCodeSchema>;
