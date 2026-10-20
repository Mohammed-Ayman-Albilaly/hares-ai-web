-- Unique indexes not expressible in Prisma (case-insensitive + NULLS NOT DISTINCT)

CREATE UNIQUE INDEX uq_user_email_lower ON "User" (lower(email));

CREATE UNIQUE INDEX uq_department_name_lower ON "Department" (lower(name));

CREATE UNIQUE INDEX uq_policy_category_action
  ON "PolicyCategoryAction" (department_id, category_code) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX uq_event_counter
  ON "EventCounter" (day, department_id, platform, risk_level, action, user_decision, rule_id)
  NULLS NOT DISTINCT;

CREATE UNIQUE INDEX uq_category_counter
  ON "CategoryCounter" (day, department_id, platform, category_code, risk_level)
  NULLS NOT DISTINCT;
