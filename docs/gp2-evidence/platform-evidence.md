# Platform evidence for the GP2 report (draft)

Answer to `report-for-platform-agent.md` (documentation agent), repository `hares-ai-web`.

- Commit every result below was produced on: `d1b35c4622b02a74c3bd75afd5de6ffea50636f3` (2026-11-23, squash of PR #1, the DGA redesign). The report pinned `bae1a5e`; `DOCS-CHANGELOG.md` lists what changed since.
- Machine: Windows 11, Intel Core i5-13420H, 16 GB RAM, Node v26.13.0 for the test suites (the shell's `node -v`; the performance scripts recorded v26.13.1, so two builds of Node 26 were present on the machine), pnpm 11.13.0, PostgreSQL 16 in Docker, Chromium from Playwright.
- Raw outputs: `docs/gp2-evidence/logs/`. Demo data only. Numbers are copied from those logs and from the result files in `perf/` and `coverage/`; nothing was estimated.

Status of the nine items

| Item | Status |
| --- | --- |
| P1 test suites | done |
| P2 coverage | done (no existing test changed; one dev dependency per package) |
| P3 accessibility | done (from the test source, history and `docs/audit.md`) |
| P4 performance | done: local run (10,383 rows), deployed API and web (run by the owner on his machine), cold start of the sleeping API (one sample, 84 s) |
| P5 security claims | all 9 claims now covered; 3 gaps closed by a new test file |
| P6 demo data | done: `pnpm --filter api seed:gp2-demo`, with a test |
| P7 gaps | done; statement 6 is **wrong** (see below) |
| P8 deployment facts | repository facts done; region, plan details, keep-awake and backup need the owner |
| P9 changelog | done (`DOCS-CHANGELOG.md`) |

New files added to the repository for this evidence (none committed yet): `DOCS-CHANGELOG.md`, `api/src/auth/security-claims.test.ts`, `api/src/dev-seed/gp2-demo.ts` and `.test.ts`, `api/prisma/seed-gp2-demo.ts`, `api/src/test/perf-env.ts`, `scripts/gp2/`, `scripts/perf/`, `docs/gp2-evidence/`. Changed files: `api/src/dev-seed/dev-seed.ts` (new optional `departments` option), `api/prisma/seed-dev.ts` (two optional environment variables), the three `package.json` files and `pnpm-lock.yaml` (the coverage plug-in). No product behaviour changed.

## P1. Results of the five suites

All on commit `d1b35c4`, run one after the other.

| Suite | Command | Files | Passed | Failed | Skipped | Duration (reported by the runner) | Log |
| --- | --- | --- | --- | --- | --- | --- | --- |
| contract | `pnpm --filter @hares/contract test` | 2 | 20 | 0 | 0 | 3.1 s | `contract-test.log` |
| web (first run) | `pnpm --filter web test` | 8 | 99 | **1** | 0 | 72.6 s | `web-test.log` |
| web (second run) | same | 8 | 100 | 0 | 0 | 24.7 s | `web-test-rerun.log` |
| API | `pnpm --filter api test` | 31 | 324 | 0 | 0 | 63.8 s | `api-test.log` |
| API end to end (real process) | `pnpm --filter api e2e` | 1 | 10 | 0 | 0 | 25.1 s | `api-e2e.log` |
| Browser end to end (Chromium, Arabic) | `pnpm e2e` | 6 spec files | 54 | 0 | 0 | 2.5 min | `browser-e2e.log` |

The failing test of the first web run: `src/pages/auth/auth-pages.test.tsx` > route guards > "sends an anonymous visitor from a private page to login" (`expected '/admin/dashboard' to be '/login'`, 20 s). It passed in the second run (24.7 s, 100 of 100). The redesign session's handover said these tests were flaky under parallel load; in the repository the only trace is their 10 s timeout (`DOCS-CHANGELOG.md`) and a comment in `auth-pages.test.tsx`: "These two render the whole router and wait for a redirect or a lazy screen: under parallel load that can pass 5s." It is reported here as it happened; it was not changed. The first run ran while other work was using the machine.

**Final runs after the new files of this evidence work were added** (same commit plus the uncommitted files listed above; product code unchanged):

| Run | Result | Log |
| --- | --- | --- |
| API alone | 33 files, **328 passed** (the 324 of P1 + 3 security tests + 1 demo-data test), 0 failed, 44.2 s | `api-test-final.log` |
| Web alone | 8 files, **100 passed**, 0 failed, 11.1 s | `web-test-final.log` |
| `pnpm -w test` (all three packages at the same time, as in CI) | contract 20 passed; API 328 passed; web **98 passed, 2 failed** | `all-tests-final.log` |

The two failures of the last row are "sends an anonymous visitor from a private page to login" and "shows 403 when a USER opens an admin page" (`auth-pages.test.tsx`, route guards). The same test failed once in the first run above. All three failures happened while the machine was busy (the packages run in parallel, or other work was running), and both tests pass when the web suite runs alone (twice, 100 of 100). Both tests already have the 10 s timeout and still failed under load, so the timeout is not a complete fix. It is a reliability limit of the web suite under load, not a product failure; it is reported here, not hidden.

Reference values given in the documentation agent's request: contract 20 and web 93, measured by it on 2026-11-18 (`bae1a5e` is dated 2026-11-09 in git). The web count is now 100 (`DOCS-CHANGELOG.md`: 93 to 100).

## P2. Code coverage

Provider: v8, Vitest. Added only a dev dependency per package (`@vitest/coverage-v8` 2.1.9 for `api` and `contract`, 5.0.5 for `web`, the same major as each package's Vitest) and ran with command-line options, so no configuration file and no test was changed. Commands (from each package folder), summaries in `docs/gp2-evidence/coverage/<package>/coverage-summary.json`, logs in `logs/coverage-*.log`:

```
pnpm exec vitest run --coverage.enabled=true --coverage.provider=v8 --coverage.reporter=json-summary --coverage.reporter=text-summary --coverage.reportsDirectory=../docs/gp2-evidence/coverage/<package> "--coverage.include=src/**" "--coverage.exclude=**/*.test.*" "--coverage.exclude=**/*.spec.*" "--coverage.exclude=src/test/**" "--coverage.exclude=src/prisma/generated/**"
```

Files that no test loads are included (`coverage.include`), so a module nobody tests shows 0 %. The per-module tables come from `node scripts/gp2/coverage-by-module.mjs` (output: `coverage/by-module.md`). The API run executed 32 files and 327 tests (the 324 of P1 plus the 3 new security tests).

| Package | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| API (`api/src`) | 96.6 % (3566/3692) | 91.1 % (1040/1141) | 98.6 % (341/346) | 96.6 % (3566/3692) |
| Web (`web/src`) | 80.3 % (1124/1400) | 74.9 % (804/1073) | 77.8 % (427/549) | 81.6 % (1011/1239) |
| Contract (`contract/src`) | 96.6 % (1607/1664) | 85.7 % (12/14) | 35.3 % (6/17) | 96.6 % (1607/1664) |

The contract package is almost only Zod schema declarations, so its function percentage is not meaningful. API modules the report asked for (lines; statements and branches are in `by-module.md`):

| Module | Folder | Lines | Branches |
| --- | --- | --- | --- |
| auth (web session, tokens, password) | `auth`, `auth/password` | 98.1 %, 98.0 % | 93.2 %, 95.5 % |
| users | `users` | 99.5 % | 91.8 % |
| departments | `departments` | 98.4 % | 94.4 % |
| policies and rules (one module) | `policy` | 99.5 % | 96.8 % |
| logs | `logs` | 98.8 % | 92.7 % |
| analytics | `analytics` | 100 % | 97.2 % |
| audit | `audit` | 100 % | 97.3 % |
| extension API | `auth/extension` (sign-in, refresh), `ingestion` (event upload); the policy bundle route is in `policy` | 100 %, 100 % | 100 %, 98.4 % |

Least covered (not raised with extra tests, as asked): API `main.ts` 0 % (process start-up), `jobs` 71.9 %, `config` 84.1 %, `retention` 86.1 %, `mail` 89.5 %; web `App.tsx` and `main.tsx` 0 % (start-up), `pages/errors` 27.8 %, `pages` (the profile page) 29.7 %, `components/charts` 40.4 % (the chart wrapper is replaced by a stub in unit tests; the real charts are covered by the browser run), `pages/auth` 47.2 %. Browser end-to-end tests (P1) are not counted here.

## P3. Accessibility audit

Test file `e2e/tests/rtl-a11y.spec.ts`, tool `@axe-core/playwright`, rule tags exactly: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`. Each audited screen must return **zero violations of any impact** (the test fails otherwise). The browser run passed (54 of 54, P1), so the count per page is 0 for every page below; no per-page axe report is saved, the 0 follows from the passing test.

| What | Pages | Language, theme |
| --- | --- | --- |
| Public | `/`, `/login`, `/register`, `/forgot-password` | Arabic and English, light |
| Employee | `/dashboard`, `/activity`, `/blocked`, `/profile` | Arabic, light |
| Department Admin | `/dashboard`, `/department/logs`, `/department/users`, `/department/policy`, `/department/rules` | Arabic, light |
| System Admin | `/admin/dashboard`, `/admin/logs`, `/admin/pending`, `/admin/users`, `/admin/departments`, `/admin/policy`, `/admin/rules`, `/admin/audit` | Arabic, light |
| Dark theme | `/admin/dashboard`, `/admin/users`, `/admin/policy`, `/admin/audit` | Arabic, dark |
| Open dialogs | approve, manage account, add rule | Arabic, light |

Also tested (not axe): skip link and focus order, every chart has a name and a table with the same numbers, badges carry text, a log row opens with the keyboard, drawer focus return, no horizontal scroll at 375 px (only on `/login`, `/register`, `/dashboard` and `/activity`), language switch, sidebar side, Western digits. Not done: screen-reader testing by hand, real devices, 200 % zoom, browsers other than Chromium; English role screens and dark theme are only partly covered.

Violations found and fixed (from `docs/audit.md` section 3 and the history; the history has these two relevant commits):

- `76721b8` (2026-10-25, B15): dialogs off-screen in right-to-left; tables making the page scroll sideways on a phone; colour contrast below 4.5:1 (secondary text, primary button, risk and success badges); accessible names that did not contain the visible text; lost focus after the mobile drawer; low border contrast on inputs and toggle, focus ring, danger button in dark theme, Arabic letter spacing, password reveal button side.
- `d1b35c4` (2026-11-23, squashed PR #1): one `TableScroller` for every table scroll region, focusable and named (axe `scrollable-region-focusable`), touch targets raised to 44 px, and a named account-menu trigger, as recorded in `docs/dga-compliance.md` (rows Hotfix and Phase 2/Group 6) and `DOCS-CHANGELOG.md`. That the scroll-region violation was found by CI on `/admin/policy` comes from the redesign session's handover, not from a file in the repository. The per-fix commits are inside the squash; the history does not separate them.

## P4. Performance

Scripts (new, in `scripts/perf/`): `measure-api.mjs` (the endpoints the extension calls), `measure-web.mjs` (dashboard and log page in a real browser, plus the CSV export) and `run-local.ts` (the local run: throwaway database, bundled API, built web app). Raw results: `docs/gp2-evidence/perf/*.json`, logs in `logs/`. Times are wall-clock milliseconds measured by the script around each request (or navigation), so they include the network. Browser: Chromium 1366x768, Arabic UI. Median, 95th percentile (p95) and maximum are over the successful requests of the run; every request of every endpoint succeeded (the "succeeded" count equals the request count in each JSON file).

Machine for every run: the owner's laptop, Windows 11, Intel Core i5-13420H, 16 GB RAM (the Windows build is `10.0.26200` in the deployed API run and `10.0.26300` in the other three runs: the machine was updated or restarted in between; Node v26.13.1 in all four). Network for the deployed runs: the owner's own internet connection (provider and location not recorded).

### Local run (2026-11-23, 19:17-19:18 UTC)

The bundled API (`api/dist/main.mjs`, what the production image runs) and the built web app (`vite preview`) on this machine, against a throwaway PostgreSQL 16 database in Docker with 10,383 activity-log rows (31 users, 5 departments, 45 days, seeded through the ingestion service; 10,433 rows when the CSV was exported, because the API test added 50). Rate limits were on. Command: `pnpm exec tsx scripts/perf/run-local.ts --events-per-user-per-day 7.7`.

| Extension endpoint | Requests | Median | p95 | Max |
| --- | --- | --- | --- | --- |
| Sign-in (`POST /api/extension/login`) | 50 | 397 ms | 488 ms | 1011 ms |
| Policy fetch, full bundle (`GET /api/policy/bundle`, 200) | 50 | 21 ms | 26 ms | 58 ms |
| Policy fetch, unchanged (304 with `If-None-Match`) | 50 | 8.5 ms | 11 ms | 18 ms |
| Event upload (`POST /api/logs`) | 50 | 18 ms | 22 ms | 27 ms |
| Token refresh (`POST /api/extension/refresh`) | 50 | 23 ms | 31 ms | 37 ms |

| Browser measurement (System Admin) | Runs | Median | Max | Min |
| --- | --- | --- | --- | --- |
| Dashboard, cold (empty browser cache): navigation until a chart is on screen | 10 | 567 ms | 1528 ms | 518 ms |
| Dashboard, warm (second visit in the same browser) | 10 | 252 ms | 288 ms | 238 ms |
| Log page, cold: navigation until the first row | 10 | 190 ms | 240 ms | 170 ms |
| Log page, warm | 10 | 175 ms | 210 ms | 156 ms |
| Log list API, first page (default size) | 10 | 17 ms | 20 ms | 15 ms |
| CSV export of all 10,433 rows (1,872,390 bytes), time to the last byte | 5 | 293 ms | 340 ms | 279 ms |

### Deployed system (Vercel + Render free instance in Frankfurt + Supabase)

**Code version of the deployed system:** not recorded by these scripts. The repository head was `d1b35c4` (merged 2026-11-23 02:08 +03:00, 23:08 UTC on 22 November) and both deployed runs came later (00:35 UTC and 19:05 UTC), but which commit Render and Vercel had deployed at that time was not checked; the owner can read it in the Render and Vercel deploy lists. Run by the owner on his own machine with the same scripts (the API run on 2026-11-23 00:35 UTC, the browser run at 19:05 UTC), through `https://hares-ai.vercel.app`, so each request goes browser, Vercel rewrite, Render, Supabase. The API was awake (an instance that is asleep is measured separately below). Employee account `perf.employee@example.test` (created for this measurement); System Admin account of the owner for the browser run. The database holds little data (the log export returned 199 rows), so the log-page numbers show the platform overhead, not a 10,000-row page.

| Extension endpoint | Requests | Median | p95 | Max |
| --- | --- | --- | --- | --- |
| Sign-in | 50 | 1892 ms | 2242 ms | 2318 ms |
| Policy fetch, full bundle (200) | 50 | 529 ms | 628 ms | 824 ms |
| Policy fetch, unchanged (304) | 50 | 535 ms | 590 ms | 3889 ms |
| Event upload | 50 | 474 ms | 536 ms | 1111 ms |
| Token refresh | 50 | 538 ms | 610 ms | 850 ms |

Zero connection resets were retried in this run. Sign-in is slow because it computes a bcrypt (cost 12) hash on the free instance's small CPU (about 0.4 s on this laptop).

| Browser measurement (System Admin, 10 runs) | Median | Max | Min |
| --- | --- | --- | --- |
| Dashboard, cold | 2065 ms | 5444 ms (first run) | 1585 ms |
| Dashboard, warm | 1525 ms | 1660 ms | 1181 ms |
| Log page, cold: first row | 1524 ms | 1679 ms | 1034 ms |
| Log page, warm | 1523 ms | 1563 ms | 1005 ms |
| Log list API, first page | 330 ms | 449 ms | 306 ms |
| CSV export (199 rows, 31,041 bytes), 5 runs | 445 ms | 486 ms | 319 ms |

Against the GP1 requirement "the administrator dashboard loads within 3 seconds": on the deployed system the median is 2.07 s cold and 1.53 s warm, and nine of the ten cold runs were between 1.59 s and 2.36 s; **one cold run took 5.4 s** (the first one), so the requirement is met for the typical load and not for every load. On the local run it is met with a large margin (0.57 s median, 1.5 s maximum).

### Cold start of the sleeping API

The owner believes no keep-awake scheduler is set up; the instance was in fact asleep when tested. Measured from this machine with `curl` against the public health route, after more than 80 minutes without any request (the last one was the owner's browser run at about 19:08 UTC); raw output in `logs/cold-start-api.txt`:

| Request (2026-11-23, UTC) | Time to the first byte | Total |
| --- | --- | --- |
| 20:31:11, first request to the sleeping instance (`https://hares-api-ltaj.onrender.com/api/health`) | **84.3 s** | 84.3 s (connection and TLS took 0.9 s; the rest is the wait) |
| 20:32:38, second request, instance awake | 0.75 s | 0.75 s |
| 20:32:41, third request | 0.48 s | 0.48 s |
| 20:32:43, same route through Vercel (`https://hares-ai.vercel.app/api/health`) | not split | 0.59 s |

This is a single cold sample (n = 1), taken by one client; it agrees with Render's own warning that a request to a sleeping free instance can be delayed by 50 seconds or more. The extension's calls and the first sign-in of the day wait this long when nobody used the platform in the previous 15 minutes.

## P5. Security claims

| Claim | Code | Test that covers it | Gap |
| --- | --- | --- | --- |
| Passwords hashed with bcrypt cost 12 | `auth.constants.ts` `BCRYPT_COST = 12` | `api/src/auth/auth.test.ts` "registers a PENDING account ... bcrypt-12 hash" (hash matches `$2?$12$`) | none |
| Passwords and hashes never returned by the API | responses are built field by field | `api/src/auth/security-claims.test.ts` "passwords and hashes are never returned" (added in this run): web login, `/auth/me`, `/profile`, the user list, the pending list and the extension login all answer 200 and contain no bcrypt-shaped value, no `password` or `password_hash` key and not the password | closed |
| Access token 15 min (web), 1 h (extension) | `WEB_ACCESS_TTL_SECONDS = 900`, `EXTENSION_ACCESS_TTL_SECONDS = 3600` | `auth.test.ts` "logs in an ACTIVE account" asserts `expires_in` = 900; `extension-auth.test.ts` asserts `<= 3600`; `security-claims.test.ts` "access tokens last 15 minutes (web) and 1 hour (extension), exactly" asserts 900 and 3600 | closed |
| Refresh token 30 days, rotating, reuse revokes the family | `REFRESH_TTL_SECONDS`, `refresh-token.service.ts` | rotation and reuse: `auth.test.ts` "rotates the refresh cookie and detects reuse by revoking the whole family"; extension: `extension-auth.test.ts` "rotates on each use and revokes the whole family when a used token is replayed", plus the 30 s grace tests | `security-claims.test.ts` "refresh tokens last 30 days": web cookie `Max-Age=2592000` and the stored extension token expires 30 days (29.99 to 30.01) after login | closed |
| Login throttle after 4 failed attempts | `throttle.ts`, `login-failure-store.ts` | `throttle.spec.ts` ("free for the first 4 failures", "doubles from the 5th failure on", cap 15 min, never a lockout); `password.test.ts` "slows down after 5 failures, never locks out, and a success clears the counter"; browser: `auth.spec.ts` | none. Precisely: the first 4 failures are free; the delay starts with the 5th failure (2 s, doubling, capped at 15 min) |
| Reset link expires after 30 min and is single use | `RESET_TTL_SECONDS = 30 * 60` | `password.test.ts` "stores only the token hash, with a 30-minute expiry", "resets once, revokes every session, then rejects reuse of the link", "rejects an expired token and a superseded token" | none |
| Each role limited to the capability matrix (19 capabilities); a Department Admin cannot read another department's logs | `contract/src/capabilities.ts` (counted: 19) | `common/guards/matrix.spec.ts` (grant for every capability and role; HTTP matrix over every guarded route); `logs.test.ts` "a Department Admin sees only their department; the department filter cannot widen it" and "detail is scoped like the list: a log outside the scope is 404"; browser `rbac.spec.ts` (15 endpoints x 3 roles) | none |
| The log endpoint rejects any field outside the 10 allowed fields | `LogEventSchema` is `.strict()` with 10 fields: `log_id`, `event_time`, `platform`, `risk_level`, `action`, `categories`, `classification_source`, `user_decision`, `rule_id` (optional), `schema_version` | `ingestion.test.ts` "rejects the non-allowlisted field %s (400 UNKNOWN_FIELD), stores nothing, echoes nothing"; browser `ingestion.spec.ts` | none |
| Logs older than 90 days deleted by the retention job | `retention.ts` `RETENTION_DAYS = 90` | `retention.test.ts` "deletes only detail rows older than 90 days; counters and the audit trail stay" | none |
| The audit log cannot be updated or deleted by the application role | privileges revoked + append-only triggers | `audit.test.ts` "has no update/delete path: the app role and the owner are both refused"; `prisma/app-role.test.ts` (cannot UPDATE, DELETE, TRUNCATE) | none |

## P6. Demo data and demo accounts

Command (development only; it refuses to run with `NODE_ENV=production` or on a database that is not on this machine):

```
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api prisma:migrate
pnpm --filter api exec tsx prisma/seed.ts     (categories, policy version, first System Admin; needs the INITIAL_ADMIN_* values of api/.env)
pnpm --filter api seed:gp2-demo
```

What it creates (structure asserted by `api/src/dev-seed/gp2-demo.test.ts`; the exact numbers below are from the recorded run `logs/gp2-demo-run.txt`):

- 3 departments: Demo Engineering, Demo Finance, Demo Human Resources; 5 people each (1 Department Admin, 4 Employees), plus the System Admin. All active.
- 1 registration waiting for approval: `pending.demo@example.test` (no role, no department).
- 2 department policies that differ from the default, set by those departments' own administrators (so the audit trail names them): Human Resources, health data WARN instead of the default BLOCK; Finance, contact data ALLOW instead of the default WARN.
- 2 custom rules, one per department, written by their administrators: `Demo employee number` (PATTERN `EMP-[0-9]{6}`, Engineering) and `Demo confidential projects` (KEYWORD, Finance).
- 304 activity-log events in the run recorded in `logs/gp2-demo-run.txt` (2026-11-23, throwaway database dropped afterwards; the count depends on the day of the week of the run, the test accepts 250 to 350) over the last 30 days: platforms ChatGPT 178, Gemini 74, Claude 52; risk HIGH 146, MEDIUM 70, LOW 5, NONE 83; actions ALLOWED 108, WARNED 102, BLOCKED 94; user decisions NONE 119, CANCELLED 61, EDITED 59, SUBMITTED_ANYWAY 43, REVISION_USED 22. They go through the same ingestion service as the extension, so counters equal logs. No message text exists anywhere.
- 4 audit-trail entries (2 policy changes, 2 rules), asserted by the test.

Demo accounts, password `Demo#Pass123` for all (development only, never use them on a real deployment):

| Role | E-mail |
| --- | --- |
| System Admin | `admin.demo@example.test` |
| Department Admin | `engineering.admin@example.test`, `finance.admin@example.test`, `human-resources.admin@example.test` |
| Employee | `engineering.user1@example.test` (same pattern `<department>.user1` to `user4`) |
| Waiting for approval | `pending.demo@example.test` |

It is safe to run again: nothing is added the second time. The existing `seed:dev` (5 departments, about 4,000 events) is unchanged and is what the test suites and the browser run use.

## P7. Statements about the system

1. **TOPIC rules (superseded on 2026-11-24 by decision 66: the extension now enforces them with an on-device model; the bundle carries `definition_en` and `threshold`, and the "not enforced yet" notice is replaced by a note about the model download).** Earlier finding: **confirmed, with the extension side taken from the extension agent.** TOPIC is one of the three rule kinds (`contract/src/enums.ts` `RULE_KINDS`), is stored and sent to the extension in the bundle's `rules`, and the rule form warns "the extension does not enforce topic rules yet" (`rules.topicNotEnforced`). The extension agent confirmed it ignores them (its code is not in this repository). Decision of the owner (`docs/DECISIONS.md` 65): keep the kind and treat the enforcement as a later phase (a private-model second pass); not removed.
2. **One deployment serves one organisation: confirmed.** The schema (`api/prisma/schema.prisma`) has no organisation or tenant table.
3. **English and Arabic with right-to-left: confirmed, with the limits of the evidence.** `web/src/i18n/ar.ts` and `en.ts` have exactly the same keys (`i18n.test.ts`, "same keys"), Arabic is the default and flips to right-to-left (`rtl-a11y.spec.ts`). The browser audit covers every screen of every role in Arabic and the public pages in English; English on the role screens is checked only by the key-parity test. No screen is known to be untranslated, but this is not proven screen by screen.
4. **No screen or endpoint shows or stores prompt text: confirmed.** No column in the schema holds text of a message; the event schema is strict (P5); no message or prompt text is stored anywhere; the only free text written by an administrator is the definition of a custom rule (a TOPIC description is hidden from Department Admins). The platform does store people's names and e-mail addresses, department names and rule names, which are not message content.
5. **Change own password: confirmed.** Endpoint `POST /api/auth/change-password` (`api/src/auth/password/password.controller.ts`, method `change`, capability `PROFILE_VIEW`); screen `/profile` (`web/src/pages/ProfilePage.tsx`). It ends every other session and gives this device a new one (`password.test.ts` "changes the password with the current one, ends other sessions and issues a new one").
6. **Wrong as written.** The platform sends **one** kind of e-mail: the password-reset link (`api/src/mail/mailer.service.ts`: "The only email the system sends is the password-reset link"; the only caller is `password-reset.service.ts`, template `api/src/auth/password/reset-email.ts`, function `buildResetEmail`). There is **no** e-mail for "registration received", "account approved" or "account rejected": those states are shown in the web app only.

## P8. Deployment facts

From the repository (`docs/DEPLOY-FREE.md`, `web/vercel.json`, `Dockerfile.api`):

- Web app: Vercel, Hobby plan, root directory `web`; `/api/*` is rewritten to the API (`web/vercel.json`). Public URL given to the documentation workflow: `https://hares-ai.vercel.app`.
- API: Render web service, free plan, Docker (`Dockerfile.api`), 512 MB, **sleeps after 15 minutes without requests**; the guide says the next request waits about a minute. Confirmed by the owner from the Render dashboard on 2026-11-23: instance type **Free**, region **Frankfurt (EU Central)**, and the dashboard states that the free instance spins down with inactivity, which can delay requests by 50 seconds or more (Render's statement, not a measurement of ours; our own cold-start measurement is below). Service URL in `web/vercel.json`: `https://hares-api-ltaj.onrender.com`. Health check `/api/health`. One instance only (rate windows live in memory, decision 27).
- Database: Supabase, session pooler (IPv4), PostgreSQL. Confirmed by the owner from the Supabase dashboard on 2026-11-23: organisation plan **Free**, project `hares-ai`, environment `main` (marked Production), region **West EU (Ireland), `eu-west-1`**, compute size **Nano**, status Healthy, **Last backup: "No backups"**; the Data API roles are revoked from the application tables (`ops/supabase-revoke-api-roles.sql`). The guide states the free plan has no daily backups and pauses after a week of inactivity. Note: the API runs in Frankfurt and the database in Ireland (different regions; `docs/DEPLOY-FREE.md` recommends the same region).
- Migrations: run from the owner's own machine with Docker (`docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --build migrate`), once and after every new migration (Render's free plan has no pre-deploy command). The job applies migrations, creates the application role, locks the audit table and seeds the categories and the first System Admin.
- Secrets: environment variables on Render (`APP_DATABASE_URL`, `JWT_ACCESS_SECRET`, `WEB_BASE_URL`, `CORS_ORIGIN`, `TRUST_PROXY`, SMTP settings); the owner-level `DATABASE_URL` and the first-admin values stay in `.env.prod` on the owner's machine and are never given to the API. `.env.prod` is not committed.
- Optional keep-awake: a free scheduler calling `/api/health` every 10 minutes (guide section 5).

**Still to be confirmed by the owner (not in the repository, not invented here):** where the secrets are stored besides the Render environment variables, and the Vercel plan (the guide says Hobby). The owner believes no keep-awake scheduler is set up; the cold-start measurement below was taken without one.

## P9. Documentation changelog

`DOCS-CHANGELOG.md` is in the repository root with the format requested. It starts with the eight lines from the redesign session (commit `d1b35c4`, and `bae1a5e` for the API test teardown).
