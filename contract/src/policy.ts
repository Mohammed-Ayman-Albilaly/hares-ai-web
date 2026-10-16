import { z } from 'zod';
import {
  CATEGORY_CODES,
  CategoryCodeSchema,
  PolicyActionSchema,
  RiskLevelSchema,
  RuleKindSchema,
} from './enums';

/**
 * Policy bundle contract (ARCHITECTURE.md §5(b), §7(b); WEB-FR-042, WEB-FR-044,
 * WEB-FR-065, WEB-FR-070). All JSON fields are snake_case.
 *
 *   GET /policy/bundle (Bearer, If-None-Match: ETag)
 *     -> 200 { version, policy, rules }  + ETag   (Cache-Control: private)
 *     -> 304 Not Modified  (unchanged version; no body)
 *
 * The bundle is served with `Cache-Control: private`; it never exposes
 * `token_version` or any auth material. The request carries no body — version
 * negotiation is via the `If-None-Match` header against `ETag = hash(version, departmentId)`.
 * `version` is a single global incremental counter per organization (WEB-FR-041).
 */

/**
 * One resolved policy entry for a category (overrides already applied;
 * ARCHITECTURE.md §5.b / WEB-FR-065). The bundle carries exactly one entry per
 * category (24), so a user with no department still receives the same shape with
 * organization defaults only (WEB-FR-070).
 */
export const PolicyEntrySchema = z.object({
  category_code: CategoryCodeSchema,
  action: PolicyActionSchema,
  enabled: z.boolean(),
});
export type PolicyEntry = z.infer<typeof PolicyEntrySchema>;

/** Resolved policy: exactly one entry per category (24), no duplicate categories. */
export const ResolvedPolicySchema = z
  .array(PolicyEntrySchema)
  .length(CATEGORY_CODES.length)
  .refine(
    (entries) => new Set(entries.map((e) => e.category_code)).size === entries.length,
    { message: 'policy must contain exactly one entry per category, with no duplicates' },
  );
export type ResolvedPolicy = z.infer<typeof ResolvedPolicySchema>;

/**
 * A custom detection rule as served to the extension (WEB-FR-034, WEB-FR-035).
 * Only enabled rules are sent, so `enabled` is not part of the bundle payload.
 */
export const PolicyRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: RuleKindSchema,
  definition: z.string(),
  risk_level: RiskLevelSchema,
  action: PolicyActionSchema,
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/** Global incremental policy bundle version (WEB-FR-041); positive integer, starts at 1. */
export const PolicyBundleVersionSchema = z.number().int().positive();
export type PolicyBundleVersion = z.infer<typeof PolicyBundleVersionSchema>;

/** Body of a 200 policy-bundle response. */
export const PolicyBundleResponseSchema = z.object({
  version: PolicyBundleVersionSchema,
  policy: ResolvedPolicySchema,
  rules: z.array(PolicyRuleSchema),
});
export type PolicyBundleResponse = z.infer<typeof PolicyBundleResponseSchema>;
