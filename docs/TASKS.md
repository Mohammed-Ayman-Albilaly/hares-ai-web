# Hares AI Web — Implementation Task Checklist

One unchecked line per batch. Tick a line when the `verify` command passes.

- [ ] **B1** — Monorepo & contract publishing (+ dev docker-compose) — `pnpm -w typecheck && pnpm --filter contract generate:openapi && docker compose -f docker-compose.dev.yml up -d`
- [ ] **B2a** — Prisma schema + init migration — `pnpm --filter api prisma migrate dev --name init`
- [ ] **B2b** — Raw SQL migrations + seed + DB tests + roles — `pnpm --filter api prisma migrate dev && pnpm --filter api prisma db seed && pnpm --filter api test`
- [ ] **B3** — API core (CommonModule) — `pnpm --filter api test && curl -s localhost:3000/api/health`
- [ ] **B4a** — Web auth (register, login, logout, refresh) — `pnpm --filter api test`
- [ ] **B4b** — Extension auth + rotation/reuse detection — `pnpm --filter api test`
- [ ] **B4c** — Forgot/reset password + login throttling (+ MailerService) — `pnpm --filter api test`
- [ ] **B4d** — Audit recording (write-only) — `pnpm --filter api test`
- [ ] **B5a** — RBAC (guards + matrix) + DepartmentsModule — `pnpm --filter api test`
- [ ] **B5b** — UsersModule lifecycle — `pnpm --filter api test`
- [ ] **B6** — PolicyModule — `pnpm --filter api test`
- [ ] **B7a** — Ingestion (with counter increments) — `pnpm --filter api test`
- [ ] **B7b** — Log review, filters, CSV export — `pnpm --filter api test`
- [ ] **B8** — Analytics endpoints + reconcile + retention purge + audit query — `pnpm --filter api test && pnpm --filter api e2e`
- [ ] **B9** — Spike: ECharts RTL/Arabic + component-library decision — manual: render Arabic/RTL charts and record the decision in `docs/SPIKE.md`
- [ ] **B10** — Web shell + auth flows — `pnpm --filter web dev` (manual) + `pnpm --filter web test`
- [ ] **B11** — Dev synthetic data seed — `pnpm --filter api seed:dev`
- [ ] **B12** — USER screens (`/dashboard`, `/activity`, `/blocked`) — `pnpm --filter web dev` (manual) + `pnpm --filter web test`
- [ ] **B13** — Department Admin screens — `pnpm --filter web dev` (manual dept-admin check)
- [ ] **B14** — System Admin screens + audit page — `pnpm --filter web e2e`
- [ ] **B15** — E2E + hardening + production containerization — `pnpm -w e2e && docker compose -f docker-compose.prod.yml build && up`
