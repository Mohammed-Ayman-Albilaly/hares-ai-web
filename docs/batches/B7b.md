## B7b — Log review, filters, CSV export
**Goal:** Read-side log tooling.
**Delivers:** scoped log review + filters (date/user/risk/category/platform/user_decision), blocked subset (action=BLOCKED), keyset-paginated CSV export (raw SQL `(event_time, log_id)` cursor, chunked), formula-injection cell prefixing, IDOR/ownership checks. (Contract schemas: `LogQuery`, `LogListResponse`, `LogDetail`, `CsvExportResponse` (headers).)
**Depends on:** B7a, B5a.
**Verify:** `pnpm --filter api test` (filters return scoped rows; CSV correct incl. `=`/`+`/`-` prefix; USER cannot read another user's logs).
**Expected files:** `api/src/logs/**`, `api/src/logs/*csv*`, `api/src/logs/*stream*`, `contract/src/**`, `api/src/logs/*.spec.ts`.