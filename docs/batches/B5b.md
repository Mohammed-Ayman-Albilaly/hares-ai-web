## B5b — UsersModule lifecycle
**Goal:** Admin user management.
**Delivers:** pending list, approve (dept+role, SYSTEM_ADMIN excluded), reject, reactivate, deactivate (bump `token_version`), change department, assign role, grant/revoke SYSTEM_ADMIN, profile view, change own password; no-self-deactivate/demote, Dept-Admin-cannot-touch-admins, service-level scope; all writes audit in the same transaction. (Contract schemas: `AdminUserResponse`, `Approve/RejectUserRequest`, `UserStatusUpdateRequest`, `AssignRoleRequest`, `ChangeDepartmentRequest`, `ProfileResponse`, `ChangePasswordRequest`.)
**Depends on:** B5a, B4d.
**Verify:** `pnpm --filter api test` (approve flow, no-self-demote, dept-admin isolation, `token_version` bump invalidates outstanding tokens).
**Expected files:** `api/src/users/**`, `api/src/users/dto/**`, `contract/src/**`, `api/src/users/*.spec.ts`, `api/package.json`.