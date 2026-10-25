# Agent rules for hares-ai-web

- Project root: D:\hares-ai-web (api/, web/, contract/, docs/, ops/, docker-compose.dev.yml). Work only inside it. Do not explore the repository; read only the files the batch names.
- Design docs (read only when the batch needs them): docs/DECISIONS.md (source of truth), docs/SPEC-WEB.md, docs/ARCHITECTURE.md, docs/DATA-MODEL.md, docs/DATA-MODEL-L4.md. The extension API contract is in contract/src (Zod). The batch plan is docs/PLAN.md (do not read it whole; use docs/batches/<ID>.md).
- Never run "prisma migrate dev" (interactive, it hangs), "prisma db push" or "prisma db pull" (they rebuild indexes from the schema alone and would lose NULLS NOT DISTINCT). Use only prisma migrate deploy, status, diff, reset --force and db seed.
- Never edit an applied migration. Add a new migration instead (create the migration folder by hand if --create-only is not possible).
- The bash tool timeout is in seconds (maximum 3600). Use 120 for quick commands and 600 for slow ones (migrate reset, tests).
- Windows shell: run commands one by one; do not chain with ";".
- Database: the dev PostgreSQL is the Docker service in docker-compose.dev.yml (container hares-postgres, user hares, database hares, port 5432). Docker Desktop must be running. Do not start any other PostgreSQL. The git-ignored file api/.env exists with DATABASE_URL, APP_DATABASE_URL and INITIAL_ADMIN_*; a file search will not show it.
- Deployment order for the database: prisma migrate deploy, then api/db/roles.sql, then ops/revoke-audit-privileges.sql (run the revoke again whenever roles.sql is re-run or AdminAuditLog is recreated).
- Prisma: the generated client is in api/src/prisma/generated (import from there); its fields are camelCase and @map to snake_case columns; table names equal model names (for example "ActivityLog"). Raw SQL objects (expression indexes, NULLS NOT DISTINCT, CHECK constraints, triggers) are not modelled in schema.prisma; the three composite unique indexes are declared with map names only so that prisma migrate diff reports no difference.
- Contract rule: if a batch adds endpoints, first add their Zod schemas to contract/ and regenerate contract/openapi.json, then write the code. All JSON fields are snake_case.
- Privacy: the backend never receives or stores prompt text. Validation errors never echo received values. Tests use synthetic data only and clean up after themselves.
- Passwords: bcrypt cost 12, reject passwords over 72 bytes, never log passwords or hashes.
- Tests that need the database skip with a clear message when it is unavailable (same style as api/src/prisma/app-role.test.ts).
- Do not commit unless asked. The Commit-Agent commits only the files it is told to, never api/.env, node_modules or docs/source/GP2_Template Report SWE 497.doc, and does not push unless told.
- For frontend batches the user invokes the UI skills; the DGA agent is review only (it must not edit files).