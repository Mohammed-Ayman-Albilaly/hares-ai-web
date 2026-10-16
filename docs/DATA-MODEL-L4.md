# Data Model L4: purge, seed, raw SQL migrations

## Item 1: Retention purge

Item 1 — ActivityLog 90-day retention purge (application-side batched loop)
SQL statement (one batch):

```sql
DELETE FROM "ActivityLog"
WHERE "log_id" IN (
  SELECT "log_id"
  FROM "ActivityLog"
  WHERE "event_time" < $1            -- cutoff (timestamptz)
  ORDER BY "event_time", "log_id"
  LIMIT $2                            -- batch size
);
-- Params: $1 = now() - interval '90 days', $2 = 10000
```

LogCategory rows cascade via ON DELETE CASCADE; EventCounter/CategoryCounter/AdminAuditLog are never touched.

Loop (4 lines):

Compute cutoff = now() - 90 days once, before the loop.
Loop with batch size 10000.
Run the DELETE; stop when rows deleted < 10000.
Return the running total deleted.
Prisma verdict (2 lines): The predicate is expressible as deleteMany({ where: { event_time: { lt: cutoff } } }), but deleteMany has no orderBy/take, so batching must be driven in app code (fetch oldest log_ids → deleteMany({ log_id: { in: [...] } })) or via raw SQL. LogCategory cascade is handled by the DB FK under default relationMode = "foreignKeys"; the advisory lock is intentionally omitted (single API instance, DECISIONS #27).

Note: if the API is ever replicated, add a Postgres advisory lock so only one instance runs the purge (ARCHITECTURE.md §3 F6).

## Item 2: Seed (DataCategory and PolicyVersion)

Item 2 — Seed: 24 categories + PolicyVersion
Source of truth for the values: docs/SPEC-WEB.md §7 (via docs/DATA-MODEL-BRIEF.md §5) with DECISIONS #13 for the previously-unassigned defaults and DECISIONS #31 for the stable UPPER_SNAKE codes. This must run as a seed script at deployment (not application runtime state).

```SQL
-- Item 2 seed: 24 DataCategory rows + the single PolicyVersion row.
-- Sources: docs/SPEC-WEB.md §7; docs/DATA-MODEL-BRIEF.md §5; DECISIONS #13/#31.
-- Idempotent: ON CONFLICT ... DO NOTHING leaves any existing row intact.

BEGIN;

INSERT INTO "DataCategory" ("category_code", "name", "default_risk_level")
VALUES
  ('CONTACT_INFO',            'Contact Information',                          'MEDIUM'),
  ('PERSONAL_IDENTITY',       'Personal Identity Data',                       'HIGH'),
  ('FINANCIAL_BANKING',       'Financial & Banking Data',                     'HIGH'),
  ('AUTH_SECRETS',            'Authentication & Security Secrets',            'HIGH'),
  ('NETWORK_SYSTEM',          'Network & System Data',                        'MEDIUM'),
  ('WEB_LINKS',               'Web Links & Identifiers',                      'MEDIUM'),
  ('LOCATION',                'Location Data',                                'MEDIUM'),
  ('HEALTH_MEDICAL',          'Health / Medical Data',                        'HIGH'),
  ('LEGAL_GOVERNMENT',        'Legal & Government Data',                      'MEDIUM'),
  ('VEHICLE',                 'Vehicle Data',                                 'MEDIUM'),
  ('CORPORATE_DOCUMENTS',     'Corporate & Document Identifiers',             'MEDIUM'),
  ('FILE_PATH',               'File & Path Data',                             'MEDIUM'),
  ('DIGITAL_FINGERPRINTS',    'Digital Fingerprints & Technical Identifiers', 'MEDIUM'),
  ('SHIPPING_LOGISTICS',      'Shipping & Logistics Data',                    'MEDIUM'),
  ('CRYPTO_CERTIFICATES',     'Cryptography & Certificates',                  'HIGH'),
  ('ACCOUNT_APPLICATION',     'Account & Application Data',                   'MEDIUM'),
  ('DATES_TIME',              'Dates & Time Data',                            'MEDIUM'),
  ('KEYWORD_PATTERNS',        'Keyword-Based Sensitive Patterns',             'LOW'),
  ('LOGS_HEADERS',            'Logs & Headers Data',                          'MEDIUM'),
  ('NUMERIC_SENSITIVE',       'Numeric Sensitive Data',                       'MEDIUM'),
  ('DEVELOPER_SECRETS',       'Developer & Code Secrets',                     'HIGH'),
  ('EDUCATION_IDS',           'Education-Related Identifiers',                'MEDIUM'),
  ('UNIVERSAL_IDS',           'Universal Identifiers',                        'LOW'),
  ('REGION_BANKING_IDENTITY', 'Region-Specific Sensitive Banking & Identity Data', 'HIGH')
ON CONFLICT ("category_code") DO NOTHING;

INSERT INTO "PolicyVersion" ("id", "version")
VALUES (1, 1)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
```

Rerun safety: both statements use `ON CONFLICT (...) DO NOTHING`, so re-running the script never duplicates rows. `DataCategory` conflicts on its `category_code` PK; `PolicyVersion` conflicts on `id` and is guaranteed a single row by its `id = 1`/PK check (DATA-MODEL.md L2). `default_risk_level` is a Postgres `risk_level` enum and version defaults to `1`, so `(1, 1)` is the intended initial state.

Note: `DO NOTHING` won't self-heal if a `name`/`default_risk_level` was later manually edited — acceptable since these are a stable extension-contract reference (DECISIONS #31). If drift repair is desired, change to `DO UPDATE SET name = EXCLUDED.name, default_risk_level = EXCLUDED.default_risk_level`. Prisma can express the same as a seed script via `createMany({ data: [...], skipDuplicates: true })` or `upsert` per row; it is not a per-request operation.

## Item 3: Bootstrap SYSTEM_ADMIN

### Script

```TypeScript
// api/prisma/seed.ts  (run via `prisma db seed` at deployment)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD_MIN_LENGTH = 8;

// Throws a clear, plain-text-only message. Never includes the password itself.
function validatePassword(pw: string): void {
  const missing: string[] = [];
  if (pw.length < PASSWORD_MIN_LENGTH) missing.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Z]/.test(pw)) missing.push('an uppercase letter');
  if (!/[a-z]/.test(pw)) missing.push('a lowercase letter');
  if (!/\d/.test(pw)) missing.push('a digit');
  if (!/[^A-Za-z0-9]/.test(pw)) missing.push('a symbol');
  if (Buffer.byteLength(pw, 'utf8') > 72) missing.push('at most 72 bytes (bcrypt limit)');
  if (missing.length > 0) {
    throw new Error(`INITIAL_ADMIN_PASSWORD does not meet the password policy: missing ${missing.join(', ')}.`);
  }
}

async function seedBootstrapAdmin() {
  const name = process.env.INITIAL_ADMIN_NAME;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('Missing INITIAL_ADMIN_NAME / INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD config.');
  }

  validatePassword(password);

  // Idempotent: create nothing if ANY user with role SYSTEM_ADMIN already exists,
  // so exactly one initial System Admin is ever seeded (WEB-FR-008).
  const existing = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });
  if (existing) return;

  // The hash is local-only; it is never logged or printed.
  const password_hash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      full_name: name,
      email: email.toLowerCase(),
      password_hash,
      role: 'SYSTEM_ADMIN',
      status: 'ACTIVE',
      department_id: null,
      token_version: 0,
      registered_at: new Date(),
      approved_at: new Date(),
    },
  });

  console.log(`Bootstrap SYSTEM_ADMIN created for ${email}.`);
}

seedBootstrapAdmin()
  .catch((e) => {
    // `e.message` is safe: for our thrown errors it contains only the clear
    // policy/config text (never the password or its hash).
    console.error(e instanceof Error ? e.message : 'Seed failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

### SQL
Note: password hashing uses bcrypt (cost 12 or higher). Passwords longer than 72 bytes are rejected.

```SQL
INSERT INTO "User"
  ("id","full_name","email","password_hash","role","department_id","approved_by",
   "status","token_version","registered_at","approved_at")
VALUES
  (gen_random_uuid(), :full_name, lower(:email), :password_hash,
   'SYSTEM_ADMIN', NULL, NULL, 'ACTIVE', 0, now(), now());
```

`:password_hash` is a bcrypt literal produced by the script (never a plaintext value); `:full_name` and `:email` come from `INITIAL_ADMIN_NAME` / `INITIAL_ADMIN_EMAIL`.

## Item 4: Raw SQL migrations (4 files)

Raw SQL migration plan — Prisma-inexpressible L2/L3 items
Scope basis: everything in L2/L3 marked Raw SQL. Excluded because Prisma can express them (per doc): the FK `ON DELETE` actions (all "Plain"), and the 10 L3 B-tree `@@indexes` (all "Plain Prisma"). Ordering: each file is a Prisma migration folder `<timestamp>_<name>/migration.sql`; run in the order below, after the Prisma-generated base tables (and their enum types, PKs, plain uniques, FKs) exist. No cross-file dependency exists between these; the order chosen is logical (references → checks → cross-table guard → immutability guards).

Prerequisite: PostgreSQL ≥ 15 for `NULLS NOT DISTINCT`. `<app_role>` is the placeholder for the application DB role; `REVOKE` must target that role, not the role running migrations.

Migration file 1 — `..._add_org_unique_indexes/migration.sql`

uq_user_email_lower
```SQL
CREATE UNIQUE INDEX uq_user_email_lower ON "User" (lower(email));
```
uq_department_name_lower
```SQL
CREATE UNIQUE INDEX uq_department_name_lower ON "Department" (lower(name));
```
uq_policy_category_action
```SQL
CREATE UNIQUE INDEX uq_policy_category_action
  ON "PolicyCategoryAction" (department_id, category_code) NULLS NOT DISTINCT;
```

uq_event_counter
```SQL
CREATE UNIQUE INDEX uq_event_counter
  ON "EventCounter" (day, department_id, platform, risk_level, action, user_decision, rule_id)
  NULLS NOT DISTINCT;
```

uq_category_counter
```SQL
CREATE UNIQUE INDEX uq_category_counter
  ON "CategoryCounter" (day, department_id, platform, category_code, risk_level)
  NULLS NOT DISTINCT;
```

Migration file 2 — `..._add_check_constraints/migration.sql`

chk_user_status_role
```SQL
ALTER TABLE "User" ADD CONSTRAINT chk_user_status_role
  CHECK ((status IN ('PENDING','REJECTED') AND role IS NULL AND department_id IS NULL)
      OR (status IN ('ACTIVE','DEACTIVATED') AND role IS NOT NULL));
```

chk_user_role_department
```SQL
ALTER TABLE "User" ADD CONSTRAINT chk_user_role_department
  CHECK (role IS NULL OR role = 'SYSTEM_ADMIN' OR department_id IS NOT NULL);
```

chk_event_counter_event_count
```SQL
ALTER TABLE "EventCounter" ADD CONSTRAINT chk_event_counter_event_count
  CHECK (event_count >= 0);
```

chk_category_counter_event_count
```SQL
ALTER TABLE "CategoryCounter" ADD CONSTRAINT chk_category_counter_event_count
  CHECK (event_count >= 0);
```

chk_activity_log_schema_version
```SQL
ALTER TABLE "ActivityLog" ADD CONSTRAINT chk_activity_log_schema_version
  CHECK (schema_version >= 1);
```

chk_policy_version_id
```SQL
ALTER TABLE "PolicyVersion" ADD CONSTRAINT chk_policy_version_id
  CHECK (id = 1);
``

chk_policy_version_version
```SQL
ALTER TABLE "PolicyVersion" ADD CONSTRAINT chk_policy_version_version
  CHECK (version >= 1);
```

chk_custom_rule_pattern_length
```SQL
ALTER TABLE "CustomRule" ADD CONSTRAINT chk_custom_rule_pattern_length
  CHECK (kind <> 'PATTERN' OR char_length(definition) <= 512);
```

chk_custom_rule_nonpattern_length
```SQL
ALTER TABLE "CustomRule" ADD CONSTRAINT chk_custom_rule_nonpattern_length
  CHECK (kind = 'PATTERN' OR char_length(definition) <= 4000);
```

chk_custom_rule_definition_nonempty
```SQL
ALTER TABLE "CustomRule" ADD CONSTRAINT chk_custom_rule_definition_nonempty
  CHECK (char_length(definition) >= 1);
```

chk_admin_audit_log_target
```SQL
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT chk_admin_audit_log_target
  CHECK (target_type = 'POLICY' OR target_id IS NOT NULL);
```

chk_refresh_token_expires
```SQL
ALTER TABLE "RefreshToken" ADD CONSTRAINT chk_refresh_token_expires
  CHECK (expires_at > created_at);
```

chk_password_reset_token_expires
```SQL
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT chk_password_reset_token_expires
  CHECK (expires_at > created_at);
```

Migration file 3 — `..._add_custom_rule_scope_guard/migration.sql`
fn_enforce_custom_rule_scope (trigger function, used by the two deferred constraint triggers)

```SQL
CREATE FUNCTION fn_enforce_custom_rule_scope() RETURNS trigger AS $$
DECLARE
  rule_id    uuid;
  scope_val  rule_scope;
  dept_count integer;
BEGIN
  IF TG_TABLE_NAME = 'CustomRule' THEN
    rule_id := NEW.id;                       -- this trigger fires only on INSERT or UPDATE
  ELSIF TG_OP = 'DELETE' THEN
    rule_id := OLD.custom_rule_id;
  ELSE
    rule_id := NEW.custom_rule_id;
  END IF;

  SELECT scope INTO scope_val FROM "CustomRule" WHERE id = rule_id;
  IF NOT FOUND THEN
    RETURN NULL;                       -- rule no longer exists; nothing to enforce
  END IF;

  SELECT count(*) INTO dept_count
  FROM "CustomRuleDepartment" WHERE custom_rule_id = rule_id;

  IF scope_val = 'DEPARTMENTS' AND dept_count < 1 THEN
    RAISE EXCEPTION 'Custom rule % has scope DEPARTMENTS but is linked to no department.', rule_id;
  ELSIF scope_val = 'ORG_WIDE' AND dept_count > 0 THEN
    RAISE EXCEPTION 'Custom rule % has scope ORG_WIDE but is linked to department(s).', rule_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```
trg_custom_rule_scope_insert_update (deferred constraint trigger on `CustomRule`)

```SQL
CREATE CONSTRAINT TRIGGER trg_custom_rule_scope_insert_update
  AFTER INSERT OR UPDATE ON "CustomRule"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_custom_rule_scope();
```

trg_custom_rule_scope_department_changes (deferred constraint trigger on `CustomRuleDepartment`)
```SQL
CREATE CONSTRAINT TRIGGER trg_custom_rule_scope_department_changes
  AFTER INSERT OR UPDATE OR DELETE ON "CustomRuleDepartment"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_custom_rule_scope();
```

Migration file 4 — `..._add_immutability_guards/migration.sql`

fn_prevent_admin_audit_mutation (guards UPDATE/DELETE on `AdminAuditLog`)
```SQL
CREATE FUNCTION fn_prevent_admin_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; UPDATE/DELETE are not permitted.';
END;
$$ LANGUAGE plpgsql;
```

trg_admin_audit_log_no_update
```SQL
CREATE TRIGGER trg_admin_audit_log_no_update
  BEFORE UPDATE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_admin_audit_mutation();
```

trg_admin_audit_log_no_delete
```SQL
CREATE TRIGGER trg_admin_audit_log_no_delete
  BEFORE DELETE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_admin_audit_mutation();
```

fn_prevent_admin_audit_truncate (statement-level guard on `AdminAuditLog`)
```SQL
CREATE FUNCTION fn_prevent_admin_audit_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; TRUNCATE is not permitted.';
END;
$$ LANGUAGE plpgsql;
```

trg_admin_audit_log_no_truncate
```SQL
CREATE TRIGGER trg_admin_audit_log_no_truncate
  BEFORE TRUNCATE ON "AdminAuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_prevent_admin_audit_truncate();
```

fn_prevent_activity_log_update (guards UPDATE; DELETE intentionally allowed for the 90-day purge)
```SQL
CREATE FUNCTION fn_prevent_activity_log_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActivityLog rows are immutable after insert; UPDATE is not permitted.';
END;
$$ LANGUAGE plpgsql;
```

trg_activity_log_no_update
```SQL
CREATE TRIGGER trg_activity_log_no_update
  BEFORE UPDATE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_activity_log_update();
```

revoke_admin_audit_log_app_role (defense-in-depth even if a trigger is dropped)
```SQL
REVOKE UPDATE, DELETE, TRUNCATE ON "AdminAuditLog" FROM <app_role>;
```

Ordering note: all four files depend only on the Prisma base tables/enums. Unique indexes (file 1) should precede any application writes; The REVOKE step runs last, after all migrations, as a deployment script (see above), and must target the runtime app role, never the migration/owner role.