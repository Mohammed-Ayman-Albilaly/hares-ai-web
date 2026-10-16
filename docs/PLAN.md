# Hares AI Web — Implementation Plan (Batches)

Source of truth: `docs/ARCHITECTURE.md`, `docs/DATA-MODEL*.md`, `docs/DECISIONS.md`, `docs/SPEC-WEB.md`. The contract lives in `contract/` (Zod schemas) and is the bridge to the extension and the generated OpenAPI document.

**Contract rule (applies to every API batch below):** before implementing any endpoint batch, first add that batch's request and response Zod schemas to `contract/`, run the OpenAPI generator, and commit `contract/openapi.json`. Only then build the API code against the inferred types. This keeps one source of truth for runtime validation, TypeScript types, and the extension-facing contract. (B2a/B2b are DB-only, and the dev seed batch B11 uses existing ingestion internally, so neither adds new endpoint schemas.)

**Ordering notes:**
- Audit *recording* (B4d) is built before the Users batch so admin actions write audit rows in the same transaction; the audit *query* endpoint stays in B8.
- Counters are written only in B7a (ingestion); B8 only reads, reconciles, and purges. B11 seeds through the ingestion service (or runs the counter-reconcile after inserting) so the counters match the logs.
- B8 is kept as a single batch but may be split into (a) analytics endpoints + reconcile job, and (b) retention purge + audit query endpoint, when work on it starts.

---

## B1 — Monorepo & contract publishing (+ dev docker-compose)
**Goal:** Set up the monorepo, tooling, the OpenAPI pipeline, and a local dev database stack.
**Delivers:** `pnpm` workspaces (`api/`, `web/`, `contract/`), shared typecheck/lint/CI, `@asteasolutions/zod-to-openapi` generating `contract/openapi.json` from the existing Zod schemas, and `docker-compose.dev.yml` (PostgreSQL 15+ and Mailpit).
**Depends on:** none.
**Verify:** `pnpm -w typecheck`; `pnpm --filter contract generate:openapi` regenerates `contract/openapi.json`; `docker compose -f docker-compose.dev.yml up -d` → Postgres 15+ and Mailpit healthy.
**Expected files:** `package.json`, `pnpm-workspace.yaml`, `contract/package.json`, `contract/openapi.json`, `docker-compose.dev.yml`, `tsconfig.base.json`, `.eslintrc`, `vitest.config.ts`, `.github/workflows/ci.yml`, `contract/src/**`.

## B2a — Prisma schema + init migration
**Goal:** Define all tables and the generative base migration.
**Delivers:** `schema.prisma` with the 15 tables — Department, User, DataCategory, PolicyVersion, PolicyCategoryAction, CustomRule, CustomRuleDepartment, ActivityLog, LogCategory, EventCounter, CategoryCounter, AdminAuditLog, RefreshToken, PasswordResetToken, LoginAttempt — `relationMode = "foreignKeys"`, base enums, plain unique/FK/`ON DELETE` actions and the 10 L3 B-tree indexes (all plain Prisma), plus the init migration and client generation. (There is no `Policy` table; `PolicyVersion` is the single counter row. `LoginAttempt` is standalone, keyed by `(key, key_type)`, with no user FK.)
**Depends on:** B1.
**Verify:** `pnpm --filter api prisma migrate dev --name init` runs clean; `pnpm --filter api prisma generate`; the generated client typechecks.
**Expected files:** `api/prisma/schema.prisma`, `api/prisma/migrations/<ts>_init/migration.sql`, `api/src/prisma/prisma.module.ts`, `api/src/prisma/prisma.service.ts`, `api/package.json`, `api/tsconfig.json`, `api/prisma.config.ts`.

## B2b — Raw SQL migrations + seed + DB tests + roles
**Goal:** Apply the Prisma-inexpressible constraints/guards, seed reference data and the bootstrap admin, and create the two DB roles with the REVOKE step.
**Delivers:** the 4 raw SQL migration files (org unique indexes, check constraints, custom-rule scope guard, immutability guards + REVOKE), `api/prisma/seed.ts` (24 DataCategory rows + PolicyVersion row + bootstrap SYSTEM_ADMIN via `prisma db seed`), the owner and application DB roles with the `<app_role>` REVOKE deployment step, and DB-level tests proving the constraints and triggers reject bad data.
**Depends on:** B2a.
**Verify:** `pnpm --filter api prisma migrate dev` / `migrate deploy`; `pnpm --filter api prisma db seed`; `pnpm --filter api test` (DB specs: role-less ACTIVE rejected, `NULLS NOT DISTINCT` dedup, custom-rule scope guard, append-only audit, ActivityLog immutable); `psql` REVOKE check on `AdminAuditLog` for `<app_role>`.
**Expected files:** `api/prisma/migrations/*_add_org_unique_indexes/migration.sql`, `*_add_check_constraints/migration.sql`, `*_add_custom_rule_scope_guard/migration.sql`, `*_add_immutability_guards/migration.sql`, `api/prisma/seed.ts`, `api/db/roles.sql`, `api/src/**/db.spec.ts`, `api/package.json`, `api/prisma.config.ts`.

## B3 — API core (CommonModule)
**Goal:** Bootstrap the NestJS app and cross-cutting concerns.
**Delivers:** NestJS app, Zod config/env validation, PrismaModule, the consistent error-envelope filter, `request_id` + redacting logging interceptor, global validation pipe, CORS/same-origin handling, `/health`. (Contract schemas added: `HealthResponse`, `ErrorEnvelope`, correlation/request-context types.)
**Depends on:** B2b.
**Verify:** `pnpm --filter api test` (error-format spec); `curl http://localhost:3000/api/health`; a malformed request returns the envelope with code-only `details`.
**Expected files:** `api/src/common/**`, `api/src/app.module.ts`, `api/src/main.ts`, `api/src/config/**`, `api/src/health/**`, `contract/src/**`, `api/package.json`.

## B4a — Web auth (register, login, logout, refresh)
**Goal:** Core web session flows.
**Delivers:** register (→PENDING), login, logout, `/auth/refresh` (HTTP-only cookie), bcrypt hashing (cost 12), `JwtAuthGuard` (signature + expiry + `status` + `token_version`), 15-min access JWT + 30-day refresh cookie. (Contract schemas: `RegisterRequest/Response`, `LoginRequest/Response`, `RefreshRequest/Response`, `LogoutRequest`, `TokenPair`, `UserPublic`, `UserStatus`.)
**Depends on:** B3.
**Verify:** `pnpm --filter api test` (register→PENDING, login, logout clears cookie, refresh rotates, guard rejects non-ACTIVE/revoked).
**Expected files:** `api/src/auth/**`, `api/src/users/*mock*` (minimal), `api/src/common/guards/*.guard.ts`, `contract/src/**`, `api/package.json`.

## B4b — Extension auth + rotation/reuse detection
**Goal:** Extension token lifecycle.
**Delivers:** `/extension/login`, `/extension/refresh`, `/extension/logout`, refresh rotation + reuse-detection family revocation, hashed refresh store (family id + used flag), `ExtensionGuard` (`client_type=extension`), web tokens cannot call extension endpoints. (Contract schemas: `ExtensionLogin/Refresh/LogoutRequest/Response`, `ClientType`.)
**Depends on:** B4a.
**Verify:** `pnpm --filter api test` (rotate on each use; reuse revokes whole family → 401; web token vs extension endpoint denied).
**Expected files:** `api/src/auth/extension/**`, `api/src/auth/*token-store*`, `api/src/common/guards/extension.guard.ts`, `contract/src/**`, `api/package.json`.

## B4c — Forgot/reset password + login throttling (+ MailerService)
**Goal:** Password recovery, brute-force defense, and reset-email delivery.
**Delivers:** forgot/reset (single-use hashed 30-min token, rate-limited, no user enumeration), progressive per-account + per-IP login throttle (doubles after 5 failures/15 min, capped 15 min, clears on success, never lockout), persisted failure counter, `@nestjs/throttler` windows, independent extension throttling, and a **MailerService** (SMTP in production, Mailpit in development) used by the reset flow. (Contract schemas: `ForgotPasswordRequest/Response`, `ResetPasswordRequest/Response`, throttle config types.)
**Depends on:** B4b.
**Verify:** `pnpm --filter api test` (reset single-use + expiry, enumeration-consistent responses, throttle doubling + clear-on-success), plus a test asserting the reset email contains only the reset link (no prompt text, no password, no placeholders).
**Expected files:** `api/src/auth/password/**`, `api/src/mail/mailer.service.ts`, `api/src/mail/mailer.module.ts`, `api/src/auth/throttle.ts`, `api/src/auth/*failure-store*`, `contract/src/**`, `api/package.json`.

## B4d — Audit recording (write-only)
**Goal:** Append-only audit write helper used by admin actions.
**Delivers:** `AdminAuditLog` write service + same-transaction helper (acting admin id, action enum, target, timestamp, non-sensitive detail); no update/delete write path (the DB triggers from B2b block it). (Contract schemas: `AuditAction` enum + `AuditEntryInput` internal type.)
**Depends on:** B3, B2b.
**Verify:** `pnpm --filter api test` (helper writes in same tx; direct UPDATE/DELETE still rejected by trigger).
**Expected files:** `api/src/audit/audit.service.ts`, `api/src/audit/audit.module.ts`, `contract/src/**`, `api/src/**/*.spec.ts`, `api/package.json`.

## B5a — RBAC (guards + matrix) + DepartmentsModule
**Goal:** Enforcement layer and department lifecycle.
**Delivers:** `RolesGuard` + `@Roles`/capability decorator against the capability matrix (explicit `✗` → 403), department scope from the guard-loaded user row (not a token claim), Departments CRUD (list with member counts, create, rename, deactivate → blocks ingestion), department writes audit. (Contract schemas: `Role`/`Capability` enums + capability-matrix metadata, `DepartmentResponse`, `Create/Rename/DeactivateDepartmentRequest`.)
**Depends on:** B4d, B4c.
**Verify:** `pnpm --filter api test` (parameterized matrix spec — each `✗` → 403; dept create/rename/deactivate; deactivated dept blocks ingestion).
**Expected files:** `api/src/common/guards/roles.guard.ts`, `api/src/common/decorators/roles.decorator.ts`, `api/src/departments/**`, `contract/src/**`, `api/src/**/matrix.spec.ts`.

## B5b — UsersModule lifecycle
**Goal:** Admin user management.
**Delivers:** pending list, approve (dept+role, SYSTEM_ADMIN excluded), reject, reactivate, deactivate (bump `token_version`), change department, assign role, grant/revoke SYSTEM_ADMIN, profile view, change own password; no-self-deactivate/demote, Dept-Admin-cannot-touch-admins, service-level scope; all writes audit in the same transaction. (Contract schemas: `AdminUserResponse`, `Approve/RejectUserRequest`, `UserStatusUpdateRequest`, `AssignRoleRequest`, `ChangeDepartmentRequest`, `ProfileResponse`, `ChangePasswordRequest`.)
**Depends on:** B5a, B4d.
**Verify:** `pnpm --filter api test` (approve flow, no-self-demote, dept-admin isolation, `token_version` bump invalidates outstanding tokens).
**Expected files:** `api/src/users/**`, `api/src/users/dto/**`, `contract/src/**`, `api/src/users/*.spec.ts`, `api/package.json`.

## B6 — PolicyModule
**Goal:** Org/department policy + custom rules + versioned bundle.
**Delivers:** org default + per-dept policy, custom rules (PATTERN/KEYWORD/TOPIC) with regex length + ReDoS-safe validation (safe-regex2/redos-detector + restricted syntax), versioned bundle + `ETag`/`If-None-Match` + `Cache-Control: private`, extension bundle endpoint (never exposes `token_version`), version bump in the same transaction, policy writes audit. (Contract schemas: `PolicyCategoryActionRequest/Response`, `CustomRuleRequest/Response`, `CustomRuleKind/Scope` enums, `PolicyBundleResponse`, ETag types.)
**Depends on:** B5b, B5a, B4d.
**Verify:** `pnpm --filter api test` (same version → 304, change → 200 + new ETag; ReDoS rejected at save; bundle body has no auth material).
**Expected files:** `api/src/policy/**`, `api/src/policy/*regex-validation*`, `contract/src/**`, `api/src/policy/*.spec.ts`, `api/package.json`.

## B7a — Ingestion (with counter increments)
**Goal:** Metadata-only strict ingestion.
**Delivers:** Zod `.strict()` allowlist + enum/`schema_version` gating (unknown field → 400 with accepted values, prompt-text field rejected), identity from token + live user row (snapshot department), inactive user/department → 403, `EVENT_TIME_OUT_OF_RANGE`, raw-SQL `ON CONFLICT (log_id) DO NOTHING RETURNING` idempotency, EventCounter/CategoryCounter upsert in the same transaction (raw SQL for `NULLS NOT DISTINCT`), per-user rate limit + payload cap. (Contract schemas: `IngestLogRequest` (allowlisted metadata), `IngestLogResponse`, `SchemaVersion` enum, ingestion error codes.)
**Depends on:** B6, B5a, B2b.
**Verify:** `pnpm --filter api test` (201 new, 200 dup idempotent, 400 unknown/prompt-text field, 401 revoked, 403 inactive dept, counter incremented exactly once on duplicate).
**Expected files:** `api/src/ingestion/**`, `api/src/ingestion/*allowlist*`, `api/src/ingestion/*raw-sql*`, `contract/src/**`, `api/src/ingestion/*.spec.ts`.

## B7b — Log review, filters, CSV export
**Goal:** Read-side log tooling.
**Delivers:** scoped log review + filters (date/user/risk/category/platform/user_decision), blocked subset (action=BLOCKED), keyset-paginated CSV export (raw SQL `(event_time, log_id)` cursor, chunked), formula-injection cell prefixing, IDOR/ownership checks. (Contract schemas: `LogQuery`, `LogListResponse`, `LogDetail`, `CsvExportResponse` (headers).)
**Depends on:** B7a, B5a.
**Verify:** `pnpm --filter api test` (filters return scoped rows; CSV correct incl. `=`/`+`/`-` prefix; USER cannot read another user's logs).
**Expected files:** `api/src/logs/**`, `api/src/logs/*csv*`, `api/src/logs/*stream*`, `contract/src/**`, `api/src/logs/*.spec.ts`.

## B8 — Analytics endpoints + reconcile + retention purge + audit query
**Goal:** Aggregation, repairs, retention, and the audit read endpoint.
**Delivers:** role-scoped dashboard aggregates (event + category counter reads; totals only from event counters, no writes), counter-reconcile job, 90-day batched purge (application-side batched DELETE loop preserving counters, advisory-lock note), and the audit query endpoint (`GET /audit`). (Contract schemas: `DashboardSummaryResponse`, `DashboardTimeseriesResponse`, `AnalyticsQuery`, `AuditQueryResponse`.)
**Depends on:** B7a, B7b, B2b, B4d.
**Verify:** `pnpm --filter api test` (analytics totals match counters; reconcile repairs drift; purge deletes only old ActivityLog rows while keeping counters/audit; audit query returns append-only rows); scheduled-job smoke run + `pnpm --filter api e2e`.
**Expected files:** `api/src/analytics/**`, `api/src/retention/**`, `api/src/audit/audit.query.ts`, `api/src/jobs/**`, `contract/src/**`, `api/src/analytics/*.spec.ts`.
**Note:** This is a single batch but may be split into (a) analytics endpoints + reconcile job, and (b) retention purge + audit query endpoint, when work on it starts.

## B9 — Spike: ECharts RTL/Arabic + component-library decision
**Goal:** De-risk UI choices before the web shell.
**Delivers:** a throwaway spike rendering Arabic/RTL ECharts (axis, legend, tooltip) with a Chart.js/table fallback, and a DGA Platform Code vs shadcn/ui + Tailwind-with-DGA-tokens evaluation; the decision recorded in `docs/`.
**Depends on:** none (standalone playground); ordered before the web shell.
**Verify:** manual — render Arabic sample data, switch to RTL, confirm axes/legend/tooltip render and are readable; record chosen chart lib + component lib + token mapping in `docs/SPIKE.md`/`docs/DECISIONS.md`.
**Expected files:** `spike/` (or `web/src/spike`), `docs/SPIKE.md`, `docs/DECISIONS.md`, spike `package.json`.

## B10 — Web shell + auth flows
**Goal:** SPA shell and session handling.
**Delivers:** Vite React app, chosen component lib + Tailwind + DGA tokens, react-i18next (`ar`/`en`, `dir`/`lang`, persisted switcher), TanStack Query, auth context, silent refresh on boot, `RequireAuth`/`RequireRole` guards, public + authenticated layout shells, route map; pages `/`, `/register`, `/login`, `/forgot-password`, `/profile`.
**Depends on:** B9, B4a, B4b, B4c, B5a, B5b.
**Verify:** `pnpm --filter web dev` (manual register/login/silent-refresh/RTL/guards) + `pnpm --filter web test`.
**Expected files:** `web/src/**`, `web/vite.config.ts`, `web/tailwind.config.ts`, `web/index.html`, `web/package.json`, `web/src/i18n/**`.

## B11 — Dev synthetic data seed
**Goal:** Populate realistic, synthetic-only data for dashboards.
**Delivers:** dev-only `api/prisma/seed-dev.ts` generating logs across departments/platforms with synthetic values only (never prompt text), respecting `schema_version`/`event_time` constraints, plus a run command; enables non-empty dashboards and charts. The seed writes logs through the same ingestion service function (or runs the counter-reconcile after inserting) so the counters match the logs.
**Depends on:** B7a, B7b, B5b, B6.
**Verify:** `pnpm --filter api seed:dev` → logs/counters populated (`psql` count > 0); confirm no prompt-text fields written; counters match log counts.
**Expected files:** `api/prisma/seed-dev.ts`, `api/package.json`, `api/src/**/seed-dev.spec.ts`, `docs/DEV-README.md`.

## B12 — USER screens (`/dashboard`, `/activity`, `/blocked`)
**Goal:** Role-scoped user views.
**Delivers:** dashboard, activity, and blocked views with loading/empty/error+retry/populated states, filters, charts (per the B9 decision), accessible and RTL.
**Depends on:** B8, B7b, B10, B11.
**Verify:** `pnpm --filter web dev` manual with seeded data (RTL charts, filters) + `pnpm --filter web test` + partial `pnpm --filter web e2e`.
**Expected files:** `web/src/pages/dashboard/**`, `web/src/pages/activity/**`, `web/src/pages/blocked/**`, `web/src/components/**`, `web/src/store/**`, `web/src/**/spec.ts`.

## B13 — Department Admin screens
**Goal:** Dept-scoped admin UI.
**Delivers:** `/department/logs`, `/department/users`, `/department/policy` (read-only), `/department/rules` (read-only), dept-scoped `/dashboard`.
**Depends on:** B12, B5a, B6.
**Verify:** manual as a Dept Admin (data scoped to own dept; policy/rules read-only; a direct edit attempt → 403).
**Expected files:** `web/src/pages/department/**`, `web/src/components/**`, `web/src/store/**`, `web/src/**/spec.ts`.

## B14 — System Admin screens + audit page
**Goal:** Full admin control UI.
**Delivers:** `/admin/dashboard`, `/admin/logs`, `/admin/users`, `/admin/pending`, `/admin/departments`, `/admin/policy`, `/admin/rules`, `/admin/audit` (audit query endpoint from B8).
**Depends on:** B13, B5b, B6, B5a, B8.
**Verify:** `pnpm --filter web e2e` manual journey (register→pending→approve→admin dashboard; audit entries render).
**Expected files:** `web/src/pages/admin/**`, `web/src/components/**`, `web/src/store/**`, `web/src/**/spec.ts`.

## B15 — E2E + hardening + production containerization
**Goal:** Release-ready integration and packaging.
**Delivers:** Playwright suite (auth, RBAC matrix, ingestion via seed/mock, RTL+a11y, CSV export), accessibility audit, and production-style containerization (api + web images; managed Postgres; no dev container).
**Depends on:** B12, B13, B14.
**Verify:** `pnpm -w e2e`; `docker compose -f docker-compose.prod.yml build && up`; run axe on key pages.
**Expected files:** `e2e/`, `playwright.config.ts`, `Dockerfile.api`, `Dockerfile.web`, `docker-compose.prod.yml`, `docs/audit.md`, `package.json`.
