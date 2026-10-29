-- ---------------------------------------------------------------------------
-- supabase-revoke-api-roles.sql — on a Supabase database, take every table and
-- sequence of the public schema away from the roles of Supabase's Data API
-- (anon, authenticated). Supabase grants them ALL on new public tables by
-- default, which would expose the users table (password hashes included) through
-- the REST API to anyone holding the project's public anon key. The app never
-- uses that API; only the owner and the application role may reach the data.
--
-- Runs from api/scripts/prod-init.sh after the migrations, so tables added by a
-- later migration are covered too. On any other PostgreSQL the roles do not
-- exist and this file does nothing.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      -- Tables the owner creates later start without these grants as well.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
