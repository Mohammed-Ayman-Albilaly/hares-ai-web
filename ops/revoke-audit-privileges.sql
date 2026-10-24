-- ---------------------------------------------------------------------------
-- REQUIRED RUN ORDER (from the repo root, with $DATABASE_URL as the owner/`hares` role):
--   1. prisma migrate deploy
--   2. api/db/roles.sql
--   3. ops/revoke-audit-privileges.sql   (this file — always LAST)
--
-- RULE: re-run this file EVERY TIME api/db/roles.sql is re-run and whenever the
-- "AdminAuditLog" table is recreated, because roles.sql re-grants UPDATE/DELETE/
-- TRUNCATE on the audit table. Only this revoke restores the append-only lock.
-- ---------------------------------------------------------------------------
-- revoke-audit-privileges.sql — lock the append-only audit trail so the app
-- role can write to it but never rewrite or destroy it. Run LAST, after
-- roles.sql has created the role and granted the broad all-table grants:
--
--   psql "$DATABASE_URL" -v app_role=hares_app -f ops/revoke-audit-privileges.sql
--
-- Safe to run twice: REVOKE of a privilege the role does not hold is a no-op.

\set ON_ERROR_STOP on

REVOKE UPDATE, DELETE, TRUNCATE ON "AdminAuditLog" FROM :"app_role";
