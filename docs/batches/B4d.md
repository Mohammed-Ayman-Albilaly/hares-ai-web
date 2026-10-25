## B4d — Audit recording (write-only)
**Goal:** Append-only audit write helper used by admin actions.
**Delivers:** `AdminAuditLog` write service + same-transaction helper (acting admin id, action enum, target, timestamp, non-sensitive detail); no update/delete write path (the DB triggers from B2b block it). (Contract schemas: `AuditAction` enum + `AuditEntryInput` internal type.)
**Depends on:** B3, B2b.
**Verify:** `pnpm --filter api test` (helper writes in same tx; direct UPDATE/DELETE still rejected by trigger).
**Expected files:** `api/src/audit/audit.service.ts`, `api/src/audit/audit.module.ts`, `contract/src/**`, `api/src/**/*.spec.ts`, `api/package.json`.