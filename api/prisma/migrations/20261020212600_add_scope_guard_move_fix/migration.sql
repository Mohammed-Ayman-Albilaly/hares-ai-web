-- Fix the CustomRule scope guard for row moves, and pin search_path on the
-- guard functions so they cannot be subverted by a caller's search_path.
--
-- 1. The deferred trigger on "CustomRuleDepartment" fires on UPDATE too. When an
--    UPDATE moves a row from rule A to rule B (custom_rule_id changes), the old
--    implementation only validated NEW.custom_rule_id (rule B). That let a move
--    leave rule A linked to no department (DEPARTMENTS scope) or attach a
--    department to an ORG_WIDE rule. Factor the check so it runs for EVERY
--    affected rule: OLD and NEW when they differ, otherwise the single rule.
--
-- 2. Pin search_path at the function level so the guard's table lookups and
--    enum resolution always resolve against pg_catalog + public.

CREATE OR REPLACE FUNCTION fn_enforce_custom_rule_scope() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  rule_ids   uuid[];
  rid        uuid;
  scope_val  rule_scope;
  dept_count integer;
BEGIN
  IF TG_TABLE_NAME = 'CustomRule' THEN
    -- this trigger fires only on INSERT or UPDATE of the rule itself
    rule_ids := ARRAY[NEW.id];
  ELSIF TG_OP = 'DELETE' THEN
    rule_ids := ARRAY[OLD.custom_rule_id];
  ELSIF TG_OP = 'UPDATE' THEN
    -- a row moved from one rule to another affects both the source and target
    IF OLD.custom_rule_id IS DISTINCT FROM NEW.custom_rule_id THEN
      rule_ids := ARRAY[OLD.custom_rule_id, NEW.custom_rule_id];
    ELSE
      rule_ids := ARRAY[NEW.custom_rule_id];
    END IF;
  ELSE  -- INSERT
    rule_ids := ARRAY[NEW.custom_rule_id];
  END IF;

  FOREACH rid IN ARRAY rule_ids LOOP
    SELECT scope INTO scope_val FROM "CustomRule" WHERE id = rid;
    IF NOT FOUND THEN
      CONTINUE;  -- rule no longer exists; nothing to enforce
    END IF;

    SELECT count(*) INTO dept_count
    FROM "CustomRuleDepartment" WHERE custom_rule_id = rid;

    IF scope_val = 'DEPARTMENTS' AND dept_count < 1 THEN
      RAISE EXCEPTION 'Custom rule % has scope DEPARTMENTS but is linked to no department.', rid;
    ELSIF scope_val = 'ORG_WIDE' AND dept_count > 0 THEN
      RAISE EXCEPTION 'Custom rule % has scope ORG_WIDE but is linked to department(s).', rid;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Harden the other guard functions against a caller-supplied search_path.

CREATE OR REPLACE FUNCTION fn_prevent_admin_audit_mutation() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; UPDATE/DELETE are not permitted.';
END;
$$;

CREATE OR REPLACE FUNCTION fn_prevent_admin_audit_truncate() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; TRUNCATE is not permitted.';
END;
$$;

CREATE OR REPLACE FUNCTION fn_prevent_activity_log_update() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'ActivityLog rows are immutable after insert; UPDATE is not permitted.';
END;
$$;
