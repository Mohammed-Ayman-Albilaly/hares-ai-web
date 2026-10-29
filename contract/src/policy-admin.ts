import { z } from 'zod';
import {
  CategoryCodeSchema,
  type CategoryCode,
  PolicyActionSchema,
  RiskLevelSchema,
  RuleKindSchema,
} from './enums';

/**
 * Policy and custom-rule administration (batch B6; WEB-FR-034..041, 065, 069;
 * decisions 5, 6, 14). All JSON fields are snake_case.
 *
 *   GET    /admin/policy/org                                  -> OrgPolicyResponse         (POLICY_VIEW)
 *   PUT    /admin/policy/org/:category   (action, enabled)    -> OrgPolicyResponse         (SA)
 *   GET    /admin/policy/departments/:id                      -> DepartmentPolicyResponse  (SA any, DA own)
 *   PUT    /admin/policy/departments/:id/:category            -> DepartmentPolicyResponse  (SA any, DA own)
 *   DELETE /admin/policy/departments/:id/:category            -> DepartmentPolicyResponse  (SA any, DA own; back to org value)
 *   GET    /admin/rules                                       -> CustomRuleListResponse    (SA all, DA applicable)
 *   POST   /admin/rules                                       -> 201 CustomRuleResponse    (SA; DA: own department only)
 *   PUT    /admin/rules/:id                                   -> CustomRuleResponse        (SA; DA: rules of own department only)
 *
 * Every write bumps the single global policy version in the same transaction.
 */

export const RULE_SCOPES = ['ORG_WIDE', 'DEPARTMENTS'] as const;
export const RuleScopeSchema = z.enum(RULE_SCOPES);
export type RuleScope = z.infer<typeof RuleScopeSchema>;

/** Where an effective policy value comes from. */
export const POLICY_SOURCES = ['DEFAULT', 'ORG', 'DEPARTMENT'] as const;
export const PolicySourceSchema = z.enum(POLICY_SOURCES);
export type PolicySource = z.infer<typeof PolicySourceSchema>;

/**
 * Built-in default when nobody configured a category (WEB-FR-065):
 * HIGH -> BLOCK, MEDIUM -> WARN, LOW -> ALLOW, NONE -> ALLOW.
 */
export const DEFAULT_ACTION_BY_RISK: Record<'HIGH' | 'MEDIUM' | 'LOW' | 'NONE', 'ALLOW' | 'WARN' | 'BLOCK'> = {
  HIGH: 'BLOCK',
  MEDIUM: 'WARN',
  LOW: 'ALLOW',
  NONE: 'ALLOW',
};

/**
 * Categories whose built-in default differs from the one their risk level gives.
 * PERSONAL_IDENTITY also covers person names (the extension reports every name
 * under it), so blocking it by default would block any message that mentions a person.
 */
export const DEFAULT_ACTION_OVERRIDES: Partial<Record<CategoryCode, 'ALLOW' | 'WARN' | 'BLOCK'>> = {
  PERSONAL_IDENTITY: 'WARN',
};

export function defaultActionFor(code: CategoryCode, risk: keyof typeof DEFAULT_ACTION_BY_RISK): 'ALLOW' | 'WARN' | 'BLOCK' {
  return DEFAULT_ACTION_OVERRIDES[code] ?? DEFAULT_ACTION_BY_RISK[risk];
}

export const CategoryPolicyEntrySchema = z.object({
  category_code: CategoryCodeSchema,
  name: z.string(),
  default_risk_level: RiskLevelSchema,
  action: PolicyActionSchema,
  enabled: z.boolean(),
  source: PolicySourceSchema,
});
export type CategoryPolicyEntry = z.infer<typeof CategoryPolicyEntrySchema>;

export const OrgPolicyResponseSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(CategoryPolicyEntrySchema),
});
export type OrgPolicyResponse = z.infer<typeof OrgPolicyResponseSchema>;

export const DepartmentPolicyResponseSchema = OrgPolicyResponseSchema.extend({
  department_id: z.string().uuid(),
});
export type DepartmentPolicyResponse = z.infer<typeof DepartmentPolicyResponseSchema>;

/** PolicyCategoryActionRequest */
export const PolicyCategoryActionRequestSchema = z
  .object({
    action: PolicyActionSchema,
    enabled: z.boolean(),
  })
  .strict();
export type PolicyCategoryActionRequest = z.infer<typeof PolicyCategoryActionRequestSchema>;

export const PolicyCategoryParamSchema = CategoryCodeSchema;

// ---------- Custom rules ----------

export const PATTERN_MAX_LENGTH = 512;

/**
 * The flags a PATTERN rule is validated under, and the flags the extension MUST
 * compile it with: case-insensitive only. The ReDoS analyser (redos-detector)
 * cannot model the unicode flag together with case-insensitivity, so unicode
 * property escapes (\p{L}) are not available in rules. The analysis and the
 * execution test use exactly these flags, so what is accepted here is what
 * runs in the extension.
 */
export const PATTERN_FLAGS = 'i';
export const TEXT_DEFINITION_MAX_LENGTH = 4000;
export const KEYWORD_MAX_WORDS = 200;
export const KEYWORD_MAX_WORD_LENGTH = 64;

/** KEYWORD definitions are one word or phrase per line. */
export function splitKeywords(definition: string): string[] {
  return definition
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

const RuleNameSchema = z.string().trim().min(1).max(100);

/**
 * CustomRuleRequest. Per-kind shape checks run here (length, word list); the
 * regex safety checks (ReDoS) run in the API because they need the analyser.
 */
export const CustomRuleRequestSchema = z
  .object({
    name: RuleNameSchema,
    kind: RuleKindSchema,
    definition: z.string().max(TEXT_DEFINITION_MAX_LENGTH),
    risk_level: RiskLevelSchema,
    action: PolicyActionSchema,
    scope: RuleScopeSchema,
    /** Required (non-empty) for DEPARTMENTS, must be empty or absent for ORG_WIDE. */
    department_ids: z.array(z.string().uuid()).max(200).default([]),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (r.definition.trim().length === 0) issue('definition', 'rule.definition_required');
    if (r.kind === 'PATTERN' && r.definition.length > PATTERN_MAX_LENGTH) issue('definition', 'rule.pattern_too_long');
    if (r.kind === 'KEYWORD') {
      const words = splitKeywords(r.definition);
      if (words.length === 0) issue('definition', 'rule.definition_required');
      if (words.length > KEYWORD_MAX_WORDS) issue('definition', 'rule.too_many_keywords');
      if (words.some((w) => w.length > KEYWORD_MAX_WORD_LENGTH)) issue('definition', 'rule.keyword_too_long');
    }
    if (r.scope === 'DEPARTMENTS' && r.department_ids.length === 0) issue('department_ids', 'rule.departments_required');
    if (r.scope === 'ORG_WIDE' && r.department_ids.length > 0) issue('department_ids', 'rule.departments_not_allowed');
    if (new Set(r.department_ids).size !== r.department_ids.length) issue('department_ids', 'rule.departments_duplicate');
  });
export type CustomRuleRequest = z.infer<typeof CustomRuleRequestSchema>;

/** CustomRuleResponse */
export const CustomRuleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: RuleKindSchema,
  definition: z.string(),
  risk_level: RiskLevelSchema,
  action: PolicyActionSchema,
  scope: RuleScopeSchema,
  department_ids: z.array(z.string().uuid()),
  enabled: z.boolean(),
  /** Whether the caller may edit this rule (a Department Admin: only rules that apply to their department alone). */
  editable: z.boolean(),
});
export type CustomRuleResponse = z.infer<typeof CustomRuleResponseSchema>;

export const CustomRuleListResponseSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(CustomRuleResponseSchema),
});
export type CustomRuleListResponse = z.infer<typeof CustomRuleListResponseSchema>;

/** Validation message keys for an unsafe or invalid PATTERN (shown in `details.definition`). */
export const RULE_PATTERN_ERRORS = [
  'rule.pattern_invalid', // not a valid regular expression
  'rule.pattern_backreference', // backreferences are not allowed
  'rule.pattern_unsafe', // catastrophic backtracking (ReDoS) detected
  'rule.pattern_timeout', // the execution test exceeded its time limit
] as const;

export const POLICY_ERROR_CODES = [
  'RULE_NOT_FOUND', // 404
  'DEPARTMENT_NOT_FOUND', // 404 (policy or rule scope)
  'FORBIDDEN', // 403 Department Admin asking for another department's policy
] as const;
export const PolicyErrorCodeSchema = z.enum(POLICY_ERROR_CODES);
export type PolicyErrorCode = z.infer<typeof PolicyErrorCodeSchema>;

/** Bundle ETag, e.g. `"p3-AbCdEf0123456789"`: version plus a hash of (version, department). */
export const BundleETagSchema = z.string().regex(/^"p\d+-[A-Za-z0-9_-]{16}"$/);
export type BundleETag = z.infer<typeof BundleETagSchema>;
