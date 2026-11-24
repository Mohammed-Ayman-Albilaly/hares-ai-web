# Documentation changelog

One line for every change that alters behaviour, data, an endpoint, a screen, a limit or a test count.
Pure refactoring needs no line. The GP2 documentation workflow reads this file together with the git
diff and updates only the affected parts of the report.

Format: `date | commit | what changed (one sentence) | area | added, changed or removed`

Areas: auth, policy, rules, logs, dashboard, extension API, schema, deployment, tests.

2026-11-24 | (deployment only) | Vercel production branch set to main (was a branch that does not exist); merges to main now deploy to production without a manual promote | deployment | changed
2026-11-24 | (deployment only) | Live API sends e-mail through Brevo SMTP on port 2525 (Render free blocks 25/465/587); sender verified in Brevo, first reset e-mail delivered | deployment | added
2026-11-25 | (uncommitted) | seed:gp2-demo adds a TOPIC rule in effect, an old TOPIC rule without English description and 5 TOPIC log events (317 events, 4 rules) | tests | added
2026-11-25 | (uncommitted) | Demo seed counts its own policy changes instead of reading the global version (race with tests running at the same time) | tests | changed
2026-11-25 | (uncommitted) | Browser accessibility audit opens the TOPIC fields of the rule dialog and the not-in-effect marker on both rule lists; browser tests 54 -> 55 | tests | added
2026-11-25 | (uncommitted) | Performance scripts take --commit and record deployed_commit in their result files | tests | added
2026-11-24 | 5aea3ae | TOPIC rules get definition_en (English, 20-300 chars) and threshold (0.2-0.9, default 0.3); bundle format 3 carries both on every rule (null for other kinds) | extension API | added
2026-11-24 | 5aea3ae | A TOPIC rule may only WARN or ALLOW (API, form and DB CHECK); migration moved TOPIC BLOCK rules to WARN | rules | changed
2026-11-24 | 5aea3ae | At most 10 enabled TOPIC rules per department, org-wide counting for all (rule.topic_limit) | rules | added
2026-11-24 | 5aea3ae | Rule form: English description field, three-level sensitivity, model-download note replaces "not enforced yet" | rules | changed
2026-11-24 | 5aea3ae | Enabled TOPIC rules without an English description are marked "not in effect" on the admin and department rule screens | rules | added
2026-11-24 | 833e73b | Final help text for the English topic description (agreed after the joint test) and a shorter model-download note | rules | changed
2026-11-24 | 5aea3ae | CustomRule columns definition_en and threshold with three CHECK constraints | schema | added
2026-11-24 | 5aea3ae | API tests +7 (TOPIC validation, storage, version bump, DB checks, cap, old rule seen by a Department Admin, TOPIC log event); web tests 100 -> 102 (TOPIC form, not-in-effect marker) | tests | added
2026-11-23 | d1b35c4 | Web UI redesigned to DGA identity: tokens, 44px targets, shared components, every screen; behaviour unchanged | dashboard | changed
2026-11-23 | d1b35c4 | Breadcrumb is linked navigation; page actions rendered once above content | dashboard | changed
2026-11-23 | d1b35c4 | Account menu trigger has an explicit accessible name | dashboard | changed
2026-11-23 | d1b35c4 | Department picker unified (DepartmentSelect) with a visible load-failure message on five screens | dashboard | changed
2026-11-23 | d1b35c4 | Table scroll regions keyboard-focusable and named (axe scrollable-region-focusable) | dashboard | added
2026-11-23 | d1b35c4 | Web unit tests 93 → 100; route-guard tests get a 10 s timeout | tests | changed
2026-11-09 | bae1a5e | API test teardown waits for sessions before force-dropping test DBs (PR #2) | tests | changed
2026-11-23 | d1b35c4 | docs/dga-compliance.md added as the UI accessibility and DGA evidence file | deployment | added
