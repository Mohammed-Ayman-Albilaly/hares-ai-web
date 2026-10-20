-- Immutability guards: AdminAuditLog is append-only; ActivityLog rows are immutable after insert.
-- The REVOKE statement is intentionally NOT a migration (it becomes an ops script in the next part).

CREATE FUNCTION fn_prevent_admin_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; UPDATE/DELETE are not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_no_update
  BEFORE UPDATE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_admin_audit_mutation();

CREATE TRIGGER trg_admin_audit_log_no_delete
  BEFORE DELETE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_admin_audit_mutation();

CREATE FUNCTION fn_prevent_admin_audit_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only; TRUNCATE is not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_no_truncate
  BEFORE TRUNCATE ON "AdminAuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_prevent_admin_audit_truncate();

CREATE FUNCTION fn_prevent_activity_log_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActivityLog rows are immutable after insert; UPDATE is not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_log_no_update
  BEFORE UPDATE ON "ActivityLog"
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_activity_log_update();
