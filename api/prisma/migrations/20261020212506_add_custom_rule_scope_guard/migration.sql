-- Deferred constraint triggers enforcing the CustomRule scope rule

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

CREATE CONSTRAINT TRIGGER trg_custom_rule_scope_insert_update
  AFTER INSERT OR UPDATE ON "CustomRule"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_custom_rule_scope();

CREATE CONSTRAINT TRIGGER trg_custom_rule_scope_department_changes
  AFTER INSERT OR UPDATE OR DELETE ON "CustomRuleDepartment"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_custom_rule_scope();
