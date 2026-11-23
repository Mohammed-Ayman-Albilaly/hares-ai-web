# Documentation changelog

One line for every change that alters behaviour, data, an endpoint, a screen, a limit or a test count.
Pure refactoring needs no line. The GP2 documentation workflow reads this file together with the git
diff and updates only the affected parts of the report.

Format: `date | commit | what changed (one sentence) | area | added, changed or removed`

Areas: auth, policy, rules, logs, dashboard, extension API, schema, deployment, tests.

2026-11-23 | d1b35c4 | Web UI redesigned to DGA identity: tokens, 44px targets, shared components, every screen; behaviour unchanged | dashboard | changed
2026-11-23 | d1b35c4 | Breadcrumb is linked navigation; page actions rendered once above content | dashboard | changed
2026-11-23 | d1b35c4 | Account menu trigger has an explicit accessible name | dashboard | changed
2026-11-23 | d1b35c4 | Department picker unified (DepartmentSelect) with a visible load-failure message on five screens | dashboard | changed
2026-11-23 | d1b35c4 | Table scroll regions keyboard-focusable and named (axe scrollable-region-focusable) | dashboard | added
2026-11-23 | d1b35c4 | Web unit tests 93 → 100; route-guard tests get a 10 s timeout | tests | changed
2026-11-09 | bae1a5e | API test teardown waits for sessions before force-dropping test DBs (PR #2) | tests | changed
2026-11-23 | d1b35c4 | docs/dga-compliance.md added as the UI accessibility and DGA evidence file | deployment | added
