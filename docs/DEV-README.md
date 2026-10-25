# Development guide

## Run everything locally

```bash
docker compose up -d            # PostgreSQL 16 + Mailpit (mail at http://localhost:8025)
cp api/.env.example api/.env    # then fill the values (never commit api/.env)
pnpm install
pnpm --filter api prisma:migrate
pnpm --filter api exec tsx prisma/seed.ts   # categories, policy, bootstrap admin
pnpm --filter api seed:dev                  # synthetic demo data (this file, below)
pnpm --filter api start                     # API on :3000
pnpm --filter web dev                       # web on :1420 (proxies /api to :3000)
```

## Synthetic demo data (`pnpm --filter api seed:dev`)

Fills the dashboards and charts so they are not empty. **Development only**: it refuses to run with
`NODE_ENV=production` or against a database that is not on localhost.

- 5 departments, 31 users, about 4,000 log events over the last 45 days.
- Everything is fictional. Emails use the reserved `example.test` domain. There is **no prompt text** anywhere:
  a log row only has platform, risk, action, categories, source, decision and time.
- Logs are written through the same `IngestionService` the extension uses, so the counters always match
  the logs (checked by `src/dev-seed/dev-seed.test.ts`).
- Safe to run again: ids are derived from a fixed seed, so a second run adds nothing.

Demo accounts (password `Demo#Pass123`, development only):

| Role | Email |
| --- | --- |
| System admin | `admin.demo@example.test` |
| Department admin | `engineering.admin@example.test` (also `finance`, `human-resources`, `customer-support`, `legal`) |
| User | `engineering.user1@example.test` (same pattern per department) |

## Checks before a commit

```bash
pnpm -w typecheck && pnpm -w lint && pnpm -w test
pnpm --filter api e2e
```

## Browser tests and the production stack

```bash
pnpm e2e:browser-install   # once: downloads the Chromium used by the browser tests
pnpm e2e                   # builds the web app, starts the API and web on spare ports, runs Playwright, cleans up
```

`pnpm e2e` uses a throwaway database (never the development one) and ports 3200 and 1520. Reports are in `playwright-report/`.

Production images and the compose file are described in `docs/audit.md` (section 5): copy `.env.prod.example` to `.env.prod`, fill it,
then `docker compose -f docker-compose.prod.yml --env-file .env.prod build` and `up -d`. Do not point it at the development database
cluster with the same application role name: the init job resets that role's password.
