# Platform evidence for the GP2 report, follow-up (Q1 to Q6)

Answer to `report-for-platform-agent-2.md` (documentation agent), repository `hares-ai-web`.

- Commit: `833e73befac56a426b90f006e4830e3cfc78e471` (2026-11-24, squash of PR #4; the TOPIC work is PR #3, `5aea3ae`). Q1 and Q2 ran on this commit with a clean working tree. Q4 and Q5 needed changes (listed below); the runs after them are marked "final".
- Machine: the same as in the first answer (Windows 11, Intel Core i5-13420H, 16 GB RAM), Node v26.13.0, pnpm 11.13.0, PostgreSQL 16 in Docker, Chromium from Playwright.
- Raw outputs: `docs/gp2-evidence/logs-2/`, coverage summaries in `docs/gp2-evidence/coverage-2/`. Demo data only. Every number below is copied from those files.

Files changed for this answer (not committed yet): `api/src/dev-seed/gp2-demo.ts` and `.test.ts`, `api/src/dev-seed/dev-seed.ts` (exports `stableUuid`), `api/prisma/seed-gp2-demo.ts` (prints the TOPIC count), `api/src/test/e2e-env.ts` (one old-style TOPIC rule in the browser-test data), `e2e/tests/rtl-a11y.spec.ts`, `scripts/perf/measure-api.mjs` and `measure-web.mjs` (new `--commit` option), `DOCS-CHANGELOG.md`, and the files under `docs/gp2-evidence/`. No product behaviour changed.

| Item | Status |
| --- | --- |
| Q1 test results | done; one flaky web test and two test-isolation races reported as they happened |
| Q2 coverage | moved by more than 0.5 points in web and contract: new table |
| Q3 TOPIC facts | all ten confirmed; item 6 made more precise |
| Q4 demo data | done: 2 TOPIC rules and 5 TOPIC events, idempotent, with a test |
| Q5 accessibility | done: the audit now opens the TOPIC fields and the "not in effect" marker; 55 of 55 |
| Q6 deployment | deployed commits and migration confirmed; deployed measurements re-run on 833e73b with the commit recorded; cold sample not obtained (the API was awake) |

## Q1. Test results on `833e73b`

Run one after the other, each suite alone.

| Suite | Command | Files | Tests | Passed | Failed | Skipped | Duration (runner) | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| contract | `pnpm --filter @hares/contract test` | 2 | 20 | 20 | 0 | 0 | 2.75 s | `contract-test.log` |
| web, first run | `pnpm --filter web test` | 8 | 102 | 101 | **1** | 0 | 58.99 s | `web-test.log` |
| web, second run | same | 8 | 102 | 102 | 0 | 0 | 11.73 s | `web-test-rerun.log` |
| API | `pnpm --filter api test` | 33 | 335 | 334 | **1** | 0 | 117.22 s | `api-test.log` |
| API end to end (real process) | `pnpm --filter api e2e` | 1 | 10 | 10 | 0 | 0 | 58.84 s | `api-e2e.log` |
| Browser end to end (Chromium, Arabic) | `pnpm e2e` | 6 spec files | 54 | 54 | 0 | 0 | 4.3 min | `browser-e2e.log` |
| All three packages at the same time (as in CI) | `pnpm -w test` | 2 / 8 / 33 | 20 / 102 / 335 | all | 0 | 0 | 1.25 s / 16.49 s / 41.15 s | `all-tests.log` |

Final runs after the Q4 and Q5 changes:

| Run | Result | Log |
| --- | --- | --- |
| API alone | 33 files, **335 passed**, 0 failed, 63.33 s | `api-test-final.log` |
| Browser end to end | **55 passed** (one new test, Q5), 0 failed, 2.7 min | `browser-e2e-final.log` |

The web suite did not change after Q1, so its final count is the Q1 count (102).

What failed, as it happened:

1. **Web, first run:** `src/pages/auth/auth-pages.test.tsx` > route guards > "sends an anonymous visitor from a private page to login" (`expected '/admin/dashboard' to be '/login'`, 14.2 s), **with the web suite running alone**. It passed in the second run. **Do the two route-guard tests still fail when all packages run together?** Not in this run: `pnpm -w test` passed all 102 web tests (`all-tests.log`). So the flakiness is still there, but it is not tied to running the packages together: this time it showed up when the web suite ran alone. Not changed.
2. **API, Q1 run:** `src/dev-seed/gp2-demo.test.ts` (`expected 7 to be 2`). The demo seed counted its own policy changes as the change in the single global policy version. Other test files run at the same time against the same test database and bump that version too, so it read 7. This was a fault in the evidence test added for the first answer, not in the product. Fixed in Q4: the seed now counts the changes it actually writes.
3. **API, a first final run** (`api-test-final-race.log`): `src/policy/policy.test.ts` > "sets an org value ... an identical write bumps nothing" (`expected 4 to be 3`). Same cause in the other direction: that test expects the global version to move by exactly 1, and the demo seed (running at the same time) bumps it too. The race existed since the first answer, when the demo seed already bumped the version four times. The Q4 seed first added two more bumps; one was removed (the old-style rule is written before the API-written TOPIC rule, whose bump covers it). The next run passed (335 of 335). The remaining risk is real: two test files share one global counter. A proper fix is to run the demo-seed test in its own database; that is not done here.
4. Not a test result: a first API attempt ran while Docker Desktop was stopped, so every database test was refused (`ECONNREFUSED`). It is kept as `api-test-no-database.log` and is not counted.

**Per-file counts of the API suite (final run, 33 files, 335 tests):** `logs-2/api-tests-per-file.txt`.

| File | Tests | File | Tests |
| --- | --- | --- | --- |
| `analytics/analytics.test.ts` | 12 | `departments/departments.test.ts` | 11 |
| `app.bootstrap.spec.ts` | 2 | `dev-seed/dev-seed.test.ts` | 5 |
| `audit/audit-query.test.ts` | 6 | `dev-seed/gp2-demo.test.ts` | 1 |
| `audit/audit.test.ts` | 7 | `ingestion/ingestion.test.ts` | 24 |
| `auth/auth.test.ts` | 21 | `logs/csv.spec.ts` | 9 |
| `auth/client-ip.spec.ts` | 2 | `logs/logs.test.ts` | 17 |
| `auth/extension/extension-auth.test.ts` | 14 | `mail/mailer.service.test.ts` | 1 |
| `auth/password/password.test.ts` | 17 | `policy/policy.test.ts` | 32 |
| `auth/rate-limits.test.ts` | 1 | `policy/regex-validation.spec.ts` | 17 |
| `auth/security-claims.test.ts` | 3 | `prisma/app-role.test.ts` | 9 |
| `auth/throttle.spec.ts` | 3 | `prisma/prisma.service.spec.ts` | 2 |
| `common/filters/error-format.spec.ts` | 10 | `prisma/raw-db-guards.test.ts` | 34 |
| `common/guards/matrix.spec.ts` | 7 | `prisma/seed.test.ts` | 3 |
| `common/guards/roles.guard.spec.ts` | 5 | `retention/retention.test.ts` | 8 |
| `common/interceptors/redact-logging.interceptor.spec.ts` | 4 | `users/users.test.ts` | 23 |
| `common/middleware/correlation.middleware.spec.ts` | 7 | | |
| `common/pipes/zod-validation.pipe.spec.ts` | 6 | | |
| `config/env.validation.spec.ts` | 12 | | |

From 328 to 335: `policy/policy.test.ts` +6 (TOPIC validation, storage and the default threshold, version bump on a threshold or English-text change, the database constraints, the cap of 10, an old rule as a Department Admin receives it) and `ingestion/ingestion.test.ts` +1 (a TOPIC match as the extension sends it). The web suite went from 100 to 102 (`admin.test.tsx`: the TOPIC form, the "not in effect" marker).

## Q2. Coverage

Same command as the first answer, on `833e73b`, summaries in `coverage-2/<package>/coverage-summary.json`, logs `logs-2/coverage-*.log`. Web and contract moved by more than 0.5 points in at least one figure, so here is the full table (first answer in brackets).

| Package | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| API | 96.67 % (3667/3793) [96.6] | 91.30 % (1081/1184) [91.1] | 98.57 % (345/350) [98.6] | 96.67 % (3667/3793) [96.6] |
| Web | 80.80 % (1153/1427) [80.3] | 75.31 % (848/1126) [74.9] | 78.49 % (438/558) [77.8] | 82.06 % (1034/1260) [81.6] |
| Contract | 95.80 % (1623/1694) [96.6] | 85.71 % (12/14) [85.7] | 35.29 % (6/17) [35.3] | 95.80 % (1623/1694) [96.6] |

API: unchanged within 0.5 points. Web: statements +0.51, functions +0.71 (the new rule-form code is covered by the two new tests). Contract: statements and lines −0.77. The new TOPIC validation in `policy-admin.ts` added lines that the contract package's own tests do not run; the API and web tests run them instead.

## Q3. TOPIC rules

1. **Confirmed.** `contract/src/policy-admin.ts`: `TOPIC_DEFINITION_EN_MIN_LENGTH = 20`, `TOPIC_DEFINITION_EN_MAX_LENGTH = 300` (after trimming), `ARABIC_LETTER` (no Arabic letters), required only when `enabled` is true (`rule.definition_en_required`), `TOPIC_THRESHOLD_MIN = 0.2`, `TOPIC_THRESHOLD_MAX = 0.9`, `TOPIC_THRESHOLD_DEFAULT = 0.3`, `TOPIC_SENSITIVITY = { HIGH: 0.3, MEDIUM: 0.4, LOW: 0.5 }`. The form `web/src/features/policy/RuleForm.tsx` offers those three levels (labels `rules.sensitivityLevels`; a value set through the API that is not one of the three is shown as "Custom (value)"). Tests: `policy.test.ts` "TOPIC: validates the English description, the threshold and the action" and "TOPIC: stores the trimmed English text and the threshold (default 0.3)"; `admin.test.tsx` "a TOPIC rule offers no BLOCK, needs an English description and sends the chosen sensitivity".
2. **Confirmed.** Form: the action select lists only `TOPIC_ACTIONS` (`WARN`, `ALLOW`) for TOPIC, and switching a new rule to TOPIC moves BLOCK to WARN (`RuleForm.tsx`). API: `rule.topic_block_not_allowed` (`CustomRuleRequestSchema`). Database: CHECK `CustomRule_topic_never_blocks`. Migration `20261124090000_add_topic_rule_fields`: `UPDATE "CustomRule" SET "action" = 'WARN' WHERE "kind" = 'TOPIC' AND "action" = 'BLOCK'`. Tests: `policy.test.ts` (validation test and "TOPIC: the database itself refuses BLOCK, an out-of-range threshold and TOPIC fields on another kind"), `admin.test.tsx` (no BLOCK option), browser `admin-flows.spec.ts` (no BLOCK option in a real browser).
3. **Confirmed.** `api/src/policy/policy.service.ts` `requireTopicLimit` with `TOPIC_RULES_MAX_PER_DEPARTMENT = 10`. It counts enabled org-wide TOPIC rules plus, per department, enabled TOPIC rules linked to it, and refuses a save that would exceed 10 (`rule.topic_limit`, under `details.enabled`). Users without a department receive the org-wide rules only, so the same cap covers them. Test: `policy.test.ts` "TOPIC: at most 10 enabled TOPIC rules apply to one department, org-wide rules counting for every department".
4. **Confirmed.** `web/src/features/policy/RulesTable.tsx` `TopicNotInEffect` (used by the System Admin list `AdminRulesPage.tsx` and the department list): shown when `kind = TOPIC`, `enabled` is true and `definition_en` is null. Text `rules.needsEnglish`: "غير مطبّقة حتى يُضاف لها وصف بالإنجليزية." / "Not in effect until it has an English description." A disabled rule shows no marker. Tests: `admin.test.tsx` "an enabled TOPIC rule without an English description is marked as not in effect"; browser `rtl-a11y.spec.ts` (Q5).
5. **Confirmed.** No translation code exists. The API has no HTTP client: its runtime dependencies (`api/package.json`) include no HTTP client library, and `api/src` has no `fetch` or `https` call outside the test helpers. Its only outward connections are the database (PostgreSQL) and the SMTP server for the password-reset e-mail, whose body contains the reset link and no administrator text (`api/src/auth/password/reset-email.ts`). Rule definitions are not written to the audit trail either (`recordRule` in `policy.service.ts`; `definition_en` is never audited, the threshold is).
6. **Confirmed, stated precisely.**
   - **Admin API** (`GET /api/admin/rules`, `listRules`): a System Admin receives `definition` and `definition_en` of every rule. A Department Admin receives the rules that apply to their department. For a TOPIC rule they may not edit, `definition` is `''` and `definition_en` is `''`, or `null` when the rule has no English description (so the marker can be shown; this reveals only that the text is missing). A Department Admin may edit, and therefore sees, only a TOPIC rule that applies to their department alone and that they wrote (`deptAdminMayEdit`).
   - **Screens:** the rule tables never show the text of any TOPIC rule, for any role ("Hidden (confidential description)").
   - **Extension bundle:** every signed-in extension user receives `definition` and `definition_en` of the enabled rules that apply to them, whatever their role. A Department Admin who uses the extension therefore receives the text in their bundle. This was already true for `definition` before the TOPIC work.
   - **Audit trail:** neither description, for anyone.
   - Tests: `policy.test.ts` "a Department Admin never receives the text of a TOPIC rule ..." (checks both fields) and "TOPIC: a rule saved before decision 66 (no English text) reaches a Department Admin as null, not hidden"; browser `admin-flows.spec.ts`.
7. **Format 3** (`BUNDLE_FORMAT = 3` in `policy.service.ts`). The format number is part of the ETag hash (`bundleETag`). After the deploy, an extension's stored ETag no longer matches, so its next `If-None-Match` request gets a full 200 instead of 304. The 200 body has the same fields as before, and every rule carries two more: `definition_en` and `threshold` (both `null` for PATTERN and KEYWORD). Nothing was removed or renamed, and a TOPIC rule never arrives as BLOCK. There is no version negotiation, so the platform does not know which format a client expects. What a format-2 extension does with it comes from the extension's developer, not from this repository: its parser ignores unknown fields on the bundle and on each rule and checks no format number, and the version before TOPIC support dropped TOPIC rules entirely.
8. **Display of a TOPIC match** (`rule_id` set, `categories: []`, `classification_source: LOCAL_AI`):
   - **Log screens** (employee activity, department and organisation logs; `web/src/features/logs/LogTable.tsx`): the "Data types found" column shows one neutral pill "قاعدة: <rule name>" / "Rule: <rule name>" instead of a category. Risk, action and decision columns as usual. The expanded row lists the rule pill under "Detected". The classification source is not shown on any screen. The API can filter the log list by `rule_id`; the screens offer no rule filter. The same display applies to a KEYWORD or PATTERN match without a category.
   - **Dashboards** (`api/src/analytics/analytics.service.ts`): totals, actions, risk levels, platforms, departments and top users come from `EventCounter` and include the event. The category chart comes from `CategoryCounter` and does not include it (no category). There is no chart per rule.
   - **CSV export** (`CSV_COLUMNS`, `logs.service.ts`): `categories` is empty, `classification_source` is `LOCAL_AI`, `rule_id` is the rule's id. There is no rule-name column.
9. **Database** (counted in the migrated dev database, `pg_catalog`, and in `schema.prisma`): **15 tables** (plus Prisma's `_prisma_migrations`), **14 enums**, **11 columns in `CustomRule`** (`id`, `created_by`, `kind`, `name`, `definition`, `risk_level`, `action`, `scope`, `enabled`, `definition_en`, `threshold`), **16 CHECK constraints** in total (13 from `20261020212447_add_check_constraints`, 3 from `20261124090000_add_topic_rule_fields`). Unchanged from the report: 15 tables, 14 enums.
10. **OpenAPI** (`contract/openapi.json`): **51 operations**, unchanged. The TOPIC work changed schemas, not endpoints.

## Q4. Demo data

`pnpm --filter api seed:gp2-demo` now also creates (`api/src/dev-seed/gp2-demo.ts`):

- `Demo layoff plans`: TOPIC, Human Resources, written by that department's admin through the API, English description "This text discusses layoffs, job cuts or restructuring.", threshold 0.3 (High), WARN, MEDIUM. **In effect.**
- `Demo old topic rule (no English description)`: TOPIC, Finance, enabled, `definition_en` null, threshold 0.3, WARN. It is written directly, because the API no longer accepts such a rule, and has no audit entry (like a rule left by the migration). **Not in effect:** the screens show the marker and the extension skips it.
- 5 events of the rule in effect from Human Resources employees on the 5 days before the run: WARNED, MEDIUM, `LOCAL_AI`, no category, decisions EDITED 2, CANCELLED 2, SUBMITTED_ANYWAY 1, platforms ChatGPT, Gemini and Claude. Stable ids, so a second run adds nothing.

Recorded run on a throwaway database (`logs-2/gp2-demo-run.txt`, 2026-11-24 21:29 UTC, dropped afterwards): 3 departments, 16 users + 1 pending, **317 events** (312 generated + 5 TOPIC), platforms ChatGPT 194, Gemini 78, Claude 45; risk HIGH 165, MEDIUM 76, NONE 73, LOW 3; actions WARNED 116, ALLOWED 104, BLOCKED 97; decisions NONE 116, EDITED 62, SUBMITTED_ANYWAY 60, CANCELLED 54, REVISION_USED 25. **4 rules**, audit entries POLICY_CHANGED 2, RULE_CHANGED 3. Second run: 0 events created, 0 policy changes, 0 TOPIC events, still 317 events and 4 rules. The generated count depends on the day of the run (304 in the first answer). Test: `gp2-demo.test.ts` asserts the 4 rule kinds, both TOPIC rules with their fields, the 5 TOPIC events (WARNED, LOCAL_AI, no category), the audit counts and idempotence.

Screenshots: sign in as `admin.demo@example.test` for the rule list (both TOPIC rules, the marker on the old one) and the organisation logs (the rule pill), or as `human-resources.admin@example.test` to open `Demo layoff plans` in the form (they wrote it, so they see its text).

## Q5. Accessibility of the changed screens

`e2e/tests/rtl-a11y.spec.ts`, same axe tags as before (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), zero violations of any impact required, Arabic, light theme.

- **"Add rule" dialog:** audited as before (default kind), then the test switches the kind to TOPIC, checks that "الوصف بالإنجليزية" and "الحساسية" are visible, and audits again ("rule dialog, TOPIC"). That covers the English description, the sensitivity select and hint, the action hint and the warning note.
- **`/admin/rules`:** audited in "SYSTEM_ADMIN: every screen". The browser-test data now holds one old-style TOPIC rule (`api/src/test/e2e-env.ts`), and the dialogs test first checks that its "not in effect" marker is visible.
- **`/department/rules`:** audited in "DEPARTMENT_ADMIN: every screen" and in a new test, "the Department Admin rule list shows the 'not in effect' marker and stays accessible".
- **Result:** 55 of 55 passed (`browser-e2e-final.log`), so 0 violations on all of them.

## Q6. Still open

1. **Deployment: yes, the current commit is deployed and the migration is applied.**
   - **Render** (service `hares-api`, owner's dashboard 2026-11-24, 07:50 +03:00): `833e73b` Live ("Deploy live for 833e73b", the redeploy after the SMTP settings changed at 07:49).
   - **Vercel** (project `hares-ai`, owner's dashboard 2026-11-24, 06:00 +03:00): `833e73b` on `main`, environment **Production**, deployed automatically.
   - **Migration** `20261124090000_add_topic_rule_fields`: applied to the production database (Supabase, `eu-west-1`) by the owner on 2026-11-24, before PR #3 was merged. Output and the column check in the Supabase SQL editor: `logs-2/production-migrate.txt`.
   - **Two deployment changes the same day,** both seen on the owner's dashboards:
     - Vercel's production branch was set to `testing-for-different-deployment`, a branch that does not exist, so merges to `main` built only Preview deployments and production was promoted by hand. It is now `main`, and PR #4 was the first production deployment made automatically.
     - The live API now sends e-mail through **Brevo** (`smtp-relay.brevo.com`, port **2525**). Render's free plan blocks outbound SMTP on ports 25, 465 and 587 (Render changelog, September 2025), so the usual ports cannot work there. Sender `Hares AI <m.ay.albilaly@gmail.com>`, verified in Brevo. Brevo warns that a free-mail sender domain is not recommended, so messages may land in spam. First password-reset e-mail received on 2026-11-24 at 07:51 +03:00. Only Render's environment changed; the code did not.
2. **Deployed measurements: re-run on 2026-11-24, deployed commit `833e73b` recorded in both result files** (`deployed_commit`). Same scripts and same laptop as the first answer (Windows build 10.0.26300, Node v26.13.1). The script was started by the agent; the owner typed the two passwords at its prompts, and they were not stored. Path: browser or script, Vercel rewrite, Render (Frankfurt, free instance, awake), Supabase (Ireland). Raw results: `perf/api-deployed-2.json` (22:04 UTC) and `perf/web-deployed-2.json` (22:05 UTC). Logs: `logs-2/perf-*-deployed.log`.
   - **Account for the API run:** a new test employee, `perf.employee2@example.test` (department "Perf Test"). It was registered and approved through the normal screens on 2026-11-24 (about 21:55 UTC) because the password of the first test account was lost. The run uploaded 50 synthetic events under that account, as the first run did under `perf.employee@example.test`.
   - **Account for the browser run:** the owner's System Admin account.

   | Extension endpoint | Requests | Median | p95 | Max | First answer (median / p95) |
   | --- | --- | --- | --- | --- | --- |
   | Sign-in | 50 | 1866 ms | 2224 ms | 2317 ms | 1892 / 2242 ms |
   | Policy fetch, full bundle (200) | 50 | 567 ms | 1497 ms | 2654 ms | 529 / 628 ms |
   | Policy fetch, unchanged (304) | 50 | 469 ms | 832 ms | 1011 ms | 535 / 590 ms |
   | Event upload | 50 | 380 ms | 564 ms | 653 ms | 474 / 536 ms |
   | Token refresh | 50 | 465 ms | 909 ms | 1068 ms | 538 / 610 ms |

   All 250 requests succeeded, and no connection reset was retried. Medians are close to the first answer. The p95 of the full bundle rose (1497 ms against 628 ms), with a maximum of 2654 ms. The bundle now carries two more fields per rule, but a few slow answers in one run over the public internet are as likely a cause; one run cannot tell which.

   | Browser measurement (System Admin, 10 runs) | Median | Max | Min | First answer (median) |
   | --- | --- | --- | --- | --- |
   | Dashboard, cold | 1615 ms | 5427 ms (first run) | 1446 ms | 2065 ms |
   | Dashboard, warm | 1191 ms | 1576 ms | 1002 ms | 1525 ms |
   | Log page, cold: first row | 971 ms | 1020 ms | 951 ms | 1524 ms |
   | Log page, warm | 976 ms | 1507 ms | 953 ms | 1523 ms |
   | Log list API, first page | 272 ms | 321 ms | 265 ms | 330 ms |
   | CSV export (313 rows, 48,663 bytes), 5 runs | 309 ms | 415 ms | 289 ms | 445 ms |

   **Against the GP1 requirement** "the administrator dashboard loads within 3 seconds": the same picture as in the first answer. Cold median 1.62 s, warm median 1.19 s, nine of ten cold runs between 1.45 s and 2.64 s. **The first cold run took 5.4 s**, so the requirement is met for the typical load but not for every load.

   **Cold start:** not obtained. At 2026-11-24 21:28 UTC the API answered the first request in 0.55 s (`logs-2/cold-start-attempt.txt`), and the health route reported an uptime of 9,720 s, so the instance had been awake since about 18:46 UTC. An extension that is signed in keeps the free instance awake, because it calls the API regularly. A cold sample needs at least 15 minutes with no extension signed in and no other use; the first answer's single sample (84 s) stays the only one.
3. **Owner questions.**
   - **Vercel plan:** **Hobby**, shown on the owner's Vercel dashboard screenshots of 2026-11-24 ("Hares-AI Hobby").
   - **Where secrets are kept besides the Render environment variables:** still to be confirmed by the owner. What is known from the repository and from the work of 2026-11-24:
     - the owner-level `DATABASE_URL` and the first-admin values are in `.env.prod` on the owner's machine (not committed);
     - the Brevo SMTP key exists only in Render's environment (Brevo shows it once; the owner was asked not to keep a copy);
     - according to the deploy guide, Vercel holds no secret, only `ENABLE_EXPERIMENTAL_COREPACK` (not checked on the dashboard);
     - the database password is also managed in the Supabase dashboard.
