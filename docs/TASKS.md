# Hares AI Web — Implementation Task Checklist

One unchecked line per batch. Tick a line when the `verify` command passes.

- [x] **B1** — Monorepo & contract publishing (+ dev docker-compose) — `pnpm -w typecheck && pnpm --filter contract generate:openapi && docker compose -f docker-compose.dev.yml up -d`
- [x] **B2a** — Prisma schema + init migration — `pnpm --filter api prisma migrate dev --name init`
- [x] **B2b** — Raw SQL migrations + seed + DB tests + roles — `pnpm --filter api prisma migrate dev && pnpm --filter api prisma db seed && pnpm --filter api test`
- [x] **B3** — API core (CommonModule) — `pnpm --filter api test && curl -s localhost:3000/api/health`
- [x] **B4a** — Web auth (register, login, logout, refresh) — `pnpm --filter api test`
- [x] **B4b** — Extension auth + rotation/reuse detection — `pnpm --filter api test`
- [x] **B4c** — Forgot/reset password + login throttling (+ MailerService) — `pnpm --filter api test`
- [x] **B4d** — Audit recording (write-only) — `pnpm --filter api test`
- [x] **B5a** — RBAC (guards + matrix) + DepartmentsModule — `pnpm --filter api test`
- [x] **B5b** — UsersModule lifecycle — `pnpm --filter api test`
- [x] **B6** — PolicyModule — `pnpm --filter api test`
- [x] **B7a** — Ingestion (with counter increments) — `pnpm --filter api test`
- [x] **B7b** — Log review, filters, CSV export — `pnpm --filter api test`
- [x] **B8** — Analytics endpoints + reconcile + retention purge + audit query — `pnpm --filter api test && pnpm --filter api e2e`
- [x] **B9** — Spike: ECharts RTL/Arabic + component-library decision — manual: render Arabic/RTL charts and record the decision in `docs/SPIKE.md`
- [x] **B10** — Web shell + auth flows — `pnpm --filter web dev` (manual) + `pnpm --filter web test`
- [x] **B11** — Dev synthetic data seed — `pnpm --filter api seed:dev`
- [x] **B12** — USER screens (`/dashboard`, `/activity`, `/blocked`) — `pnpm --filter web dev` (manual) + `pnpm --filter web test`
- [x] **B13** — Department Admin screens — `pnpm --filter web dev` (manual dept-admin check)
- [x] **B14** — System Admin screens + audit page — `pnpm --filter web e2e`
- [x] **B15** — E2E + hardening + production containerization — `pnpm -w e2e && docker compose -f docker-compose.prod.yml build && up`
- [x] **B16** — Delegated policy administration, backend (Department Admin edits own department policy and rules, `risk_level` in the bundle, PERSONAL_IDENTITY default WARN, extension refresh grace window) — `pnpm --filter api test`
- [x] **B17** — Policy matrix screen (departments x categories), copy policy between departments, Department Admin editing screens, TOPIC "not enforced by the extension yet" notice, KEYWORD matching hint, names hint on PERSONAL_IDENTITY — `pnpm --filter web test`
- [ ] **B18** — Rule name in log list/detail for rule-only events, KEYWORD whole-word rule documented, extension-flow e2e tests when the developer sends real events — `pnpm e2e`
