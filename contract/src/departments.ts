import { z } from 'zod';

/**
 * Departments (batch B5a; WEB-FR-019, 054-056; decisions 14, 18, 23).
 * System Admin only. All JSON fields are snake_case.
 *
 *   GET  /admin/departments                    -> 200 DepartmentListResponse
 *   POST /admin/departments          (name)    -> 201 DepartmentResponse
 *   PATCH /admin/departments/:id     (name)    -> 200 DepartmentResponse
 *   POST /admin/departments/:id/deactivate     -> 200 DepartmentResponse
 *
 * Deactivating a department blocks log ingestion for its users; its logs stay
 * visible to administrators until the 90-day purge (decision 23).
 */

/** Department names are unique case-insensitively (index on lower(name)). */
export const DepartmentNameSchema = z.string().trim().min(1).max(100);

export const DepartmentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  active: z.boolean(),
  /** Users currently assigned to the department (any status). */
  member_count: z.number().int().nonnegative(),
});
export type DepartmentResponse = z.infer<typeof DepartmentResponseSchema>;

export const DepartmentListResponseSchema = z.object({
  items: z.array(DepartmentResponseSchema),
});
export type DepartmentListResponse = z.infer<typeof DepartmentListResponseSchema>;

export const CreateDepartmentRequestSchema = z.object({ name: DepartmentNameSchema }).strict();
export type CreateDepartmentRequest = z.infer<typeof CreateDepartmentRequestSchema>;

export const RenameDepartmentRequestSchema = z.object({ name: DepartmentNameSchema }).strict();
export type RenameDepartmentRequest = z.infer<typeof RenameDepartmentRequestSchema>;

/** The confirmation happens in the UI; the request carries no fields. */
export const DeactivateDepartmentRequestSchema = z.object({}).strict();
export type DeactivateDepartmentRequest = z.infer<typeof DeactivateDepartmentRequestSchema>;

export const DEPARTMENT_ERROR_CODES = [
  'DEPARTMENT_NAME_TAKEN', // 409 another department already has this name
  'DEPARTMENT_NOT_FOUND', // 404
  'DEPARTMENT_INACTIVE', // 409 deactivating an already inactive department (renaming one is allowed)
] as const;
export const DepartmentErrorCodeSchema = z.enum(DEPARTMENT_ERROR_CODES);
export type DepartmentErrorCode = z.infer<typeof DepartmentErrorCodeSchema>;

/** Path parameter for every `/:id` route. */
export const UuidParamSchema = z.string().uuid();
