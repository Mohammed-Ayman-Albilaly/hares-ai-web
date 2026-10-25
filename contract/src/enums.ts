import { z } from 'zod';

/**
 * Shared enum values, category codes and contract versioning.
 * Source of truth: docs/ARCHITECTURE.md, docs/SPEC-WEB.md.
 *
 * NOTE: written against the Zod v3 API (`z.enum`, `.email()`, `.datetime()`);
 * confirm the pinned Zod version in the scaffold before relying on top-level
 * helpers (`z.iso.datetime()` in Zod v4).
 */

// ---------- Enum values (final) ----------

export const PLATFORMS = ['CHATGPT', 'GEMINI', 'CLAUDE'] as const;
export const PlatformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof PlatformSchema>;

export const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const LOG_ACTIONS = ['BLOCKED', 'WARNED', 'ALLOWED'] as const;
export const LogActionSchema = z.enum(LOG_ACTIONS);
export type LogAction = z.infer<typeof LogActionSchema>;

export const POLICY_ACTIONS = ['ALLOW', 'WARN', 'BLOCK'] as const;
export const PolicyActionSchema = z.enum(POLICY_ACTIONS);
export type PolicyAction = z.infer<typeof PolicyActionSchema>;

export const CLASSIFICATION_SOURCES = [
  'LOCAL',
  'LOCAL_AI',
  'LOCAL_ONLY_FALLBACK',
] as const;
export const ClassificationSourceSchema = z.enum(CLASSIFICATION_SOURCES);
export type ClassificationSource = z.infer<typeof ClassificationSourceSchema>;

export const USER_DECISIONS = [
  'NONE',
  'SUBMITTED_ANYWAY',
  'EDITED',
  'REVISION_USED',
  'CANCELLED',
] as const;
export const UserDecisionSchema = z.enum(USER_DECISIONS);
export type UserDecision = z.infer<typeof UserDecisionSchema>;

export const RULE_KINDS = ['PATTERN', 'KEYWORD', 'TOPIC'] as const;
export const RuleKindSchema = z.enum(RULE_KINDS);
export type RuleKind = z.infer<typeof RuleKindSchema>;

// ---------- schema_version: positive integer, starts at 1 ----------

export const INITIAL_SCHEMA_VERSION = 1;

export const SchemaVersionSchema = z.number().int().positive().min(1);
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

// ---------- Sensitive-data category codes (24) ----------

export const CATEGORY_CODES = [
  'CONTACT_INFO',
  'PERSONAL_IDENTITY',
  'FINANCIAL_BANKING',
  'AUTH_SECRETS',
  'NETWORK_SYSTEM',
  'WEB_LINKS',
  'LOCATION',
  'HEALTH_MEDICAL',
  'LEGAL_GOVERNMENT',
  'VEHICLE',
  'CORPORATE_DOCUMENTS',
  'FILE_PATH',
  'DIGITAL_FINGERPRINTS',
  'SHIPPING_LOGISTICS',
  'CRYPTO_CERTIFICATES',
  'ACCOUNT_APPLICATION',
  'DATES_TIME',
  'KEYWORD_PATTERNS',
  'LOGS_HEADERS',
  'NUMERIC_SENSITIVE',
  'DEVELOPER_SECRETS',
  'EDUCATION_IDS',
  'UNIVERSAL_IDS',
  'REGION_BANKING_IDENTITY',
] as const;

export const CategoryCodeSchema = z.enum(CATEGORY_CODES);
export type CategoryCode = z.infer<typeof CategoryCodeSchema>;

// ---------- Web account enums ----------

export const USER_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'DEACTIVATED'] as const;
export const UserStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ROLES = ['SYSTEM_ADMIN', 'DEPARTMENT_ADMIN', 'USER'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;
