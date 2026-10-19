-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('SYSTEM_ADMIN', 'DEPARTMENT_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "rule_kind" AS ENUM ('PATTERN', 'KEYWORD', 'TOPIC');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateEnum
CREATE TYPE "log_action" AS ENUM ('BLOCKED', 'WARNED', 'ALLOWED');

-- CreateEnum
CREATE TYPE "classification_source" AS ENUM ('LOCAL', 'LOCAL_AI', 'LOCAL_ONLY_FALLBACK');

-- CreateEnum
CREATE TYPE "user_decision" AS ENUM ('NONE', 'SUBMITTED_ANYWAY', 'EDITED', 'REVISION_USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "policy_action" AS ENUM ('ALLOW', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "platform" AS ENUM ('CHATGPT', 'GEMINI', 'CLAUDE');

-- CreateEnum
CREATE TYPE "rule_scope" AS ENUM ('ORG_WIDE', 'DEPARTMENTS');

-- CreateEnum
CREATE TYPE "audit_action_type" AS ENUM ('USER_APPROVED', 'USER_REJECTED', 'USER_REOPENED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'USER_ROLE_CHANGED', 'USER_DEPARTMENT_CHANGED', 'SYSTEM_ADMIN_GRANTED', 'SYSTEM_ADMIN_REVOKED', 'DEPARTMENT_CREATED', 'DEPARTMENT_RENAMED', 'DEPARTMENT_DEACTIVATED', 'POLICY_CHANGED', 'RULE_CHANGED');

-- CreateEnum
CREATE TYPE "target_type" AS ENUM ('USER', 'DEPARTMENT', 'CUSTOM_RULE', 'POLICY');

-- CreateEnum
CREATE TYPE "key_type" AS ENUM ('ACCOUNT', 'SOURCE');

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role",
    "department_id" UUID,
    "approved_by" UUID,
    "status" "user_status" NOT NULL DEFAULT 'PENDING',
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "registered_at" TIMESTAMPTZ NOT NULL,
    "approved_at" TIMESTAMPTZ,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCategory" (
    "category_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_risk_level" "risk_level" NOT NULL,

    CONSTRAINT "DataCategory_pkey" PRIMARY KEY ("category_code")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" SMALLINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyCategoryAction" (
    "id" UUID NOT NULL,
    "department_id" UUID,
    "category_code" TEXT NOT NULL,
    "action" "policy_action" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PolicyCategoryAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRule" (
    "id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "kind" "rule_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "action" "policy_action" NOT NULL,
    "scope" "rule_scope" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CustomRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRuleDepartment" (
    "custom_rule_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,

    CONSTRAINT "CustomRuleDepartment_pkey" PRIMARY KEY ("custom_rule_id","department_id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "log_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "department_id" UUID,
    "platform" "platform" NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "action" "log_action" NOT NULL,
    "classification_source" "classification_source" NOT NULL,
    "user_decision" "user_decision" NOT NULL,
    "rule_id" UUID,
    "schema_version" INTEGER NOT NULL,
    "event_time" TIMESTAMPTZ NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "LogCategory" (
    "log_id" UUID NOT NULL,
    "category_code" TEXT NOT NULL,

    CONSTRAINT "LogCategory_pkey" PRIMARY KEY ("log_id","category_code")
);

-- CreateTable
CREATE TABLE "EventCounter" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "department_id" UUID,
    "platform" "platform" NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "action" "log_action" NOT NULL,
    "user_decision" "user_decision" NOT NULL,
    "rule_id" UUID,
    "event_count" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "EventCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCounter" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "department_id" UUID,
    "platform" "platform" NOT NULL,
    "category_code" TEXT NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "event_count" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL,
    "acting_admin_id" UUID NOT NULL,
    "action_type" "audit_action_type" NOT NULL,
    "target_type" "target_type" NOT NULL,
    "target_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" JSONB,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "key_type" "key_type" NOT NULL,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ NOT NULL,
    "next_allowed_at" TIMESTAMPTZ,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key","key_type")
);

-- CreateIndex
CREATE INDEX "User_status_registered_at_idx" ON "User"("status", "registered_at");

-- CreateIndex
CREATE INDEX "User_department_id_status_idx" ON "User"("department_id", "status");

-- CreateIndex
CREATE INDEX "ActivityLog_department_id_event_time_log_id_idx" ON "ActivityLog"("department_id", "event_time", "log_id");

-- CreateIndex
CREATE INDEX "ActivityLog_event_time_log_id_idx" ON "ActivityLog"("event_time", "log_id");

-- CreateIndex
CREATE INDEX "ActivityLog_user_id_event_time_log_id_idx" ON "ActivityLog"("user_id", "event_time", "log_id");

-- CreateIndex
CREATE INDEX "LogCategory_category_code_log_id_idx" ON "LogCategory"("category_code", "log_id");

-- CreateIndex
CREATE INDEX "AdminAuditLog_created_at_id_idx" ON "AdminAuditLog"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_hash_key" ON "RefreshToken"("token_hash");

-- CreateIndex
CREATE INDEX "RefreshToken_family_id_idx" ON "RefreshToken"("family_id");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_expires_at_idx" ON "RefreshToken"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_hash_key" ON "PasswordResetToken"("token_hash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCategoryAction" ADD CONSTRAINT "PolicyCategoryAction_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCategoryAction" ADD CONSTRAINT "PolicyCategoryAction_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "DataCategory"("category_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRule" ADD CONSTRAINT "CustomRule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRuleDepartment" ADD CONSTRAINT "CustomRuleDepartment_custom_rule_id_fkey" FOREIGN KEY ("custom_rule_id") REFERENCES "CustomRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRuleDepartment" ADD CONSTRAINT "CustomRuleDepartment_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "CustomRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogCategory" ADD CONSTRAINT "LogCategory_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "ActivityLog"("log_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogCategory" ADD CONSTRAINT "LogCategory_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "DataCategory"("category_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCounter" ADD CONSTRAINT "EventCounter_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCounter" ADD CONSTRAINT "EventCounter_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "CustomRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCounter" ADD CONSTRAINT "CategoryCounter_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCounter" ADD CONSTRAINT "CategoryCounter_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "DataCategory"("category_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_acting_admin_id_fkey" FOREIGN KEY ("acting_admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
