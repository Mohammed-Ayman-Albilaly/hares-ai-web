-- CHECK constraints not expressible in Prisma

ALTER TABLE "User" ADD CONSTRAINT chk_user_status_role
  CHECK ((status IN ('PENDING','REJECTED') AND role IS NULL AND department_id IS NULL)
      OR (status IN ('ACTIVE','DEACTIVATED') AND role IS NOT NULL));

ALTER TABLE "User" ADD CONSTRAINT chk_user_role_department
  CHECK (role IS NULL OR role = 'SYSTEM_ADMIN' OR department_id IS NOT NULL);

ALTER TABLE "EventCounter" ADD CONSTRAINT chk_event_counter_event_count
  CHECK (event_count >= 0);

ALTER TABLE "CategoryCounter" ADD CONSTRAINT chk_category_counter_event_count
  CHECK (event_count >= 0);

ALTER TABLE "ActivityLog" ADD CONSTRAINT chk_activity_log_schema_version
  CHECK (schema_version >= 1);

ALTER TABLE "PolicyVersion" ADD CONSTRAINT chk_policy_version_id
  CHECK (id = 1);

ALTER TABLE "PolicyVersion" ADD CONSTRAINT chk_policy_version_version
  CHECK (version >= 1);

ALTER TABLE "CustomRule" ADD CONSTRAINT chk_custom_rule_pattern_length
  CHECK (kind <> 'PATTERN' OR char_length(definition) <= 512);

ALTER TABLE "CustomRule" ADD CONSTRAINT chk_custom_rule_nonpattern_length
  CHECK (kind = 'PATTERN' OR char_length(definition) <= 4000);

ALTER TABLE "CustomRule" ADD CONSTRAINT chk_custom_rule_definition_nonempty
  CHECK (char_length(definition) >= 1);

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT chk_admin_audit_log_target
  CHECK (target_type = 'POLICY' OR target_id IS NOT NULL);

ALTER TABLE "RefreshToken" ADD CONSTRAINT chk_refresh_token_expires
  CHECK (expires_at > created_at);

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT chk_password_reset_token_expires
  CHECK (expires_at > created_at);
