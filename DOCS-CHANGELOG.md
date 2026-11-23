# Documentation changelog

One line for every change that alters behaviour, data, an endpoint, a screen, a limit or a test count.
Pure refactoring needs no line. The GP2 documentation workflow reads this file together with the git
diff and updates only the affected parts of the report.

Format: `date | commit | what changed (one sentence) | area | added, changed or removed`

Areas: auth, policy, rules, logs, dashboard, extension API, schema, deployment, tests.

2026-11-24 | (uncommitted) | TOPIC rules get definition_en (English, 20-300 chars) and threshold (0.2-0.9, default 0.3); bundle format 3 carries both on every rule (null for other kinds) | extension API | added
2026-11-24 | (uncommitted) | A TOPIC rule may only WARN or ALLOW (API, form and DB CHECK); migration moved TOPIC BLOCK rules to WARN | rules | changed
2026-11-24 | (uncommitted) | At most 10 enabled TOPIC rules per department, org-wide counting for all (rule.topic_limit) | rules | added
2026-11-24 | (uncommitted) | Rule form: English description field, three-level sensitivity, model-download note replaces "not enforced yet" | rules | changed
2026-11-24 | (uncommitted) | CustomRule columns definition_en and threshold with three CHECK constraints | schema | added
2026-11-24 | (uncommitted) | API tests +6 (TOPIC validation, storage, version bump, DB checks, cap, TOPIC log event); web tests +1 (TOPIC form) | tests | added
2026-11-23 | d1b35c4 | Web UI redesigned to DGA identity: tokens, 44px targets, shared components, every screen; behaviour unchanged | dashboard | changed
2026-11-23 | d1b35c4 | Breadcrumb is linked navigation; page actions rendered once above content | dashboard | changed
2026-11-23 | d1b35c4 | Account menu trigger has an explicit accessible name | dashboard | changed
2026-11-23 | d1b35c4 | Department picker unified (DepartmentSelect) with a visible load-failure message on five screens | dashboard | changed
2026-11-23 | d1b35c4 | Table scroll regions keyboard-focusable and named (axe scrollable-region-focusable) | dashboard | added
2026-11-23 | d1b35c4 | Web unit tests 93 → 100; route-guard tests get a 10 s timeout | tests | changed
2026-11-09 | bae1a5e | API test teardown waits for sessions before force-dropping test DBs (PR #2) | tests | changed
2026-11-23 | d1b35c4 | docs/dga-compliance.md added as the UI accessibility and DGA evidence file | deployment | added
