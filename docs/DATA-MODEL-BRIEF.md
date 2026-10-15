<#DATA-MODEL-BRIEF>

# Hares AI Web — PostgreSQL Data Model Brief

Sources: `docs/DECISIONS.md` (D#), `docs/ARCHITECTURE.md` (§), `docs/SPEC-WEB.md` (§). Facts copied exactly; no invention.

## 1. Hard rules

- **Privacy.** Backend MUST NEVER receive, store, log, or return any prompt text (original, masked, revised) or placeholder values; never store detected sensitive values (email, national ID, IBAN, API key, etc.) or any text derivable from a prompt. Stores metadata only. *(D#2; SPEC §6; WEB-NFR-002/011)*
- **Passwords.** Stored as a salted, one-way, computationally expensive hash; never plaintext. *(WEB-NFR-004)*
- **Tokens.** Refresh tokens stored **hashed** (family id + used flag); password-reset tokens stored **hashed** with expiry. Never plaintext. *(ARCH §9; SPEC §6; D#12/#15/#30)*
- **PostgreSQL ≥ 15** required to use `NULLS NOT DISTINCT` on unique counter indexes. *(ARCH §9)*
- **Prisma limit.** No `(a,b) < (x,y)` row-value comparisons; use raw SQL for the ingestion/CSV keyset cursor and the counter upsert. *(ARCH §9)*
- **Single org per deployment; single API instance; one origin.** Scheduled jobs use a PG advisory lock if replicated. *(D#1/#27; ARCH §3)*

## 2. Entities

**Department** — id, name (unique), active/status, member count (derived from users). Deactivating a department blocks log ingestion for its users; historical logs stay until the 90-day purge. *(D#18/#23; SPEC §6; WEB-FR-054/055/056)*

**User** — full name, email (unique), passwordHash, role (nullable until approval), department_id (nullable until approval), status, registration/approval timestamps. A `PENDING` user has department/role NULL. A `SYSTEM_ADMIN` may have no department; its events store department null. *(D#3; SPEC §3/§6; WEB-FR-064)*

**DataCategory** — category_code, name, default risk level. *(DECISIONS schema; SPEC §7)*

**PolicyVersion** — id, single global incremental `version` per organization. Any change to org default, a department override, or a custom rule increments `version` in the same transaction; `ETag = hash(version, departmentId)`. Bundle never exposes `token_version`. *(D#5/#6/#7; ARCH §5; WEB-FR-041)*

**PolicyCategoryAction** — per department, per category: action (`allow`/`warn`/`block`) + enabled flag, plus the policy bundle version it belongs to. Org default applies when no override. *(D#6; SPEC §6; WEB-FR-040/065)*

**CustomRule** — id, kind (`PATTERN`/`KEYWORD`/`TOPIC`), name, definition, risk level, action, scope (org-wide or specific departments), enabled flag, bundle version. `PATTERN` regex length-limited (≤512) and ReDoS-validated; `TOPIC` definition is admin-authored free text, not parsed/executed by the backend. *(D#5; SPEC §6; WEB-NFR-006)*

**CustomRuleDepartment** — links a custom rule to the departments in its scope. *(DECISIONS schema; D#5)*

**ActivityLog** — log_id (UUID PK), user_id, department_id (snapshot; derived server-side from the token), platform, risk_level, action, classification_source, user_decision, rule_id (nullable), schema_version, event_time, received_at. Unique index on `log_id`. Purged at 90 days. *(DECISIONS schema; SPEC §6; ARCH §4/§5; D#2/#8/#21)*

**LogCategory** — log_id, category_code; many per log. *(DECISIONS schema; SPEC §6)*

**EventCounter** — keyed by `(day, department_id nullable, platform, risk_level, action, user_decision, rule_id nullable)` with `event_count`. Totals come from this table only. department_id nullable covers System Admin events / org-wide rollups. Retained indefinitely; carries no user identity. Nullable key columns need `NULLS NOT DISTINCT` or sentinel. *(ARCH §5; DECISIONS schema; D#25; ARCH §9)*

**CategoryCounter** — keyed by `(day, department_id nullable, platform, category_code, risk_level)`; denormalised per-category breakdown for charts. Same rules as EventCounter. *(ARCH §5; DECISIONS schema)*

**AdminAuditLog** — acting admin id, action type, target user id / target resource, timestamp, non-sensitive detail. Append-only; no update/delete path plus a DB-level guard/trigger prevents mutation; written in same transaction as the admin action; never purged; never includes prompt text. *(D#11/#19; ARCH §4; SPEC §6; WEB-FR-050/052)*

**RefreshToken** — hashed token, family id, used flag, expiry. Rotated on each use; reuse detection revokes the whole family. Carries `token_version`. *(D#12/#30; ARCH §4/§9; SPEC §6)*

**PasswordResetToken** — hashed token, 30-minute expiry, single-use, rate-limited. Never plaintext; email contains only the link. *(D#15; ARCH §9; SPEC §6)*

**LoginAttempt** — persisted failure counter per account and per source address; lives across restarts; progressive delay; no hard lockout; cleared on successful login or password reset. *(D#22; WEB-NFR-020; ARCH §4)*

## 3. Enums

- **UserStatus:** `PENDING` | `ACTIVE` | `REJECTED` | `DEACTIVATED` *(D#3; SPEC §3)*
- **Role:** `SYSTEM_ADMIN` | `DEPARTMENT_ADMIN` | `USER` *(D#4; SPEC §2)*
- **RuleKind:** `PATTERN` | `KEYWORD` | `TOPIC` *(D#5)*
- **risk_level:** `HIGH` | `MEDIUM` | `LOW` | `NONE` *(DECISIONS schema; SPEC §6)*
- **action (log):** `BLOCKED` | `WARNED` | `ALLOWED` *(SPEC §6)*
- **classification_source:** `LOCAL` | `LOCAL+AI` | `LOCAL_ONLY_FALLBACK` *(SPEC §6)*
- **user_decision:** `NONE` | `SUBMITTED_ANYWAY` | `EDITED` | `REVISION_USED` | `CANCELLED` *(SPEC §6; D#21)*
- **policy action:** `allow` | `warn` | `block` *(D#6; SPEC §6)*
- **platform:** `CHATGPT` | `GEMINI` | `CLAUDE` | other supported code *(SPEC §6)*

## 4. Behaviors the model must support

- **Ingestion transaction:** `INSERT ... ON CONFLICT (log_id) DO NOTHING RETURNING`; only when a row is returned do LogCategory inserts and EventCounter/CategoryCounter increments run, in the same transaction. Duplicate `log_id` → idempotent ack (no new row, no count). Identity derived from token; client-supplied `user_id`/`department_id` rejected; deactivated user/department rejected. Allowlist + `schema_version` enum gating (unknown value rejected, never silently dropped). *(ARCH §4/§5; SPEC §6; D#2/#8/#21; WEB-NFR-021)*
- **Filters / CSV export:** filter by date range, user, risk level, category, platform, user_decision. CSV exported admin-only via keyset pagination ordered by `(event_time DESC, log_id DESC)` using raw SQL; only allowed metadata columns; prefix cells starting with `=`, `+`, `-`, `@`, tab, CR (CSV-injection). *(WEB-FR-024/025/066; ARCH §4; WEB-NFR-022)*
- **Dashboards:** totals from EventCounter only (avoid double count); category charts from CategoryCounter; counter-reconcile job repairs drift; ≤30s lag. Per-user dashboard reads live ActivityLog → bounded to 90 days. *(ARCH §5; D#25/#26; WEB-NFR-010)*
- **Policy bundle:** build from org defaults + department overrides (override wins) + custom rules; `ETag=hash(version, departmentId)`, `Cache-Control: private`; user without a department gets org defaults + org-wide rules only. *(ARCH §5; SPEC §4.6; D#5/#6/#7; WEB-FR-070)*
- **Retention:** purge ActivityLog older than 90 days; counters retained indefinitely; audit trail never purged; REJECTED records not deleted/purged. *(D#11/#24/#25; WEB-FR-067)*
- **Revocation:** `token_version` counter bumped on deactivate/reject/password change/reset; one indexed SELECT on user PK returning `status, token_version, role, department_id`. *(ARCH §4; D#12; WEB-FR-059)*

## 5. Seed: 24 categories & default risk (SPEC §7)

| # | Category | Risk |
|---|---|---|
| 1 | Contact Information | MEDIUM |
| 2 | Personal Identity Data | HIGH |
| 3 | Financial & Banking Data | HIGH |
| 4 | Authentication & Security Secrets | HIGH |
| 5 | Network & System Data | MEDIUM |
| 6 | Web Links & Identifiers | MEDIUM |
| 7 | Location Data | MEDIUM |
| 8 | Health / Medical Data | HIGH |
| 9 | Legal & Government Data | MEDIUM |
| 10 | Vehicle Data | MEDIUM |
| 11 | Corporate & Document Identifiers | MEDIUM |
| 12 | File & Path Data | MEDIUM |
| 13 | Digital Fingerprints & Technical Identifiers | MEDIUM |
| 14 | Shipping & Logistics Data | MEDIUM |
| 15 | Cryptography & Certificates | HIGH |
| 16 | Account & Application Data | MEDIUM |
| 17 | Dates & Time Data | MEDIUM |
| 18 | Keyword-Based Sensitive Patterns | LOW |
| 19 | Logs & Headers Data | MEDIUM |
| 20 | Numeric Sensitive Data | MEDIUM |
| 21 | Developer & Code Secrets | HIGH |
| 22 | Education-Related Identifiers | MEDIUM |
| 23 | Universal Identifiers | LOW |
| 24 | Region-Specific Sensitive Banking & Identity Data | HIGH |

## Decisions on gaps
1. Nullable key dedup in counter tables: use NULLS NOT DISTINCT (PostgreSQL 15+), as a raw SQL migration.
2. category_code values are stable UPPER_SNAKE codes: CONTACT_INFO, PERSONAL_IDENTITY, FINANCIAL_BANKING, AUTH_SECRETS, NETWORK_SYSTEM, WEB_LINKS, LOCATION, HEALTH_MEDICAL, LEGAL_GOVERNMENT, VEHICLE, CORPORATE_DOCUMENTS, FILE_PATH, DIGITAL_FINGERPRINTS, SHIPPING_LOGISTICS, CRYPTO_CERTIFICATES, ACCOUNT_APPLICATION, DATES_TIME, KEYWORD_PATTERNS, LOGS_HEADERS, NUMERIC_SENSITIVE, DEVELOPER_SECRETS, EDUCATION_IDS, UNIVERSAL_IDS, REGION_BANKING_IDENTITY. They are part of the extension contract and must not change.
3. LoginAttempt is an entity (login throttling state per account and per source address).
4. Department member count is computed at read time, not stored.
5. schema_version is a positive integer starting at 1.
6. Policy, logs and dashboards work at the level of the 24 data categories. Organization-specific data types are handled by custom rules. A sub-type level may be added later through a new schema_version.