## B5a — RBAC (guards + matrix) + DepartmentsModule
**Goal:** Enforcement layer and department lifecycle.
**Delivers:** `RolesGuard` + `@Roles`/capability decorator against the capability matrix (explicit `✗` → 403), department scope from the guard-loaded user row (not a token claim), Departments CRUD (list with member counts, create, rename, deactivate → blocks ingestion), department writes audit. (Contract schemas: `Role`/`Capability` enums + capability-matrix metadata, `DepartmentResponse`, `Create/Rename/DeactivateDepartmentRequest`.)
**Depends on:** B4d, B4c.
**Verify:** `pnpm --filter api test` (parameterized matrix spec — each `✗` → 403; dept create/rename/deactivate; deactivated dept blocks ingestion).
**Expected files:** `api/src/common/guards/roles.guard.ts`, `api/src/common/decorators/roles.decorator.ts`, `api/src/departments/**`, `contract/src/**`, `api/src/**/matrix.spec.ts`.