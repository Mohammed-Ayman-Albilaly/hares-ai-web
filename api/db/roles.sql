-- ---------------------------------------------------------------------------
-- REQUIRED RUN ORDER (from the repo root, with $DATABASE_URL as the owner/`hares` role):
--   1. prisma migrate deploy
--   2. api/db/roles.sql
--   3. ops/revoke-audit-privileges.sql
--
-- RULE: re-run ops/revoke-audit-privileges.sql EVERY TIME this file (roles.sql)
-- is re-run, and whenever the "AdminAuditLog" table is recreated (e.g. by a new
-- migration). The broad GRANTs below re-grant UPDATE/DELETE/TRUNCATE on the audit
-- table; only that revoke restores the append-only guarantee.
-- ---------------------------------------------------------------------------
-- roles.sql — create the application runtime role (hares_app) and grant it the
-- least privileges the app needs. Run as the owner/migration role (hares):
--
--   psql "$DATABASE_URL" \
--     -v app_role=hares_app \
--     -v app_password='<dev-only password>' \
--     -f api/db/roles.sql
--
-- The password is supplied at runtime and is never hardcoded in this file. The
-- surrounding quotes are shell quoting only, not part of the value: under
-- Windows cmd pass `-v app_password=dev-pass`, and under PowerShell / POSIX pass
-- `-v app_password='dev-pass'`.
--
-- Safe to run twice: the role is created only if missing (and its password is
-- refreshed on every run so the app can always connect), and every GRANT /
-- ALTER DEFAULT PRIVILEGES is a no-op once it already applies.

\set ON_ERROR_STOP on

-- Create the role if missing, otherwise refresh its password. The DDL is run
-- through \gexec so the psql variables are substituted outside any
-- dollar-quoted body.
SELECT
  CASE WHEN NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_role')
       THEN format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_role', :'app_password')
       ELSE format('ALTER ROLE %I PASSWORD %L', :'app_role', :'app_password')
  END
\gexec

-- Connect to the schema, but own nothing: no CREATE on the schema and no
-- ownership means the app cannot run DDL (CREATE/ALTER/DROP) or TRUNCATE.
GRANT USAGE ON SCHEMA public TO :"app_role";

-- Runtime data plane: read and mutate rows. No TRUNCATE, no DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";

-- Tables that the owner/migration role creates later inherit the same grants,
-- so a future migration adding a table keeps the app working.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
