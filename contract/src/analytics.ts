import { z } from 'zod';
import { CategoryCodeSchema, PlatformSchema } from './enums';
import { AuditActionSchema, AuditDetailSchema, AuditTargetTypeSchema } from './audit';

/**
 * Dashboards and the audit trail (batch B8; WEB-FR-028..033, 050..052, 031, 066;
 * WEB-NFR-010; decisions 11, 25, 26). All JSON fields are snake_case.
 *
 *   GET /dashboard/mine/summary|timeseries        any signed-in role: own events (live ActivityLog, last 90 days)
 *   GET /dashboard/department/summary|timeseries  Department Admin: own department; System Admin: ?department_id
 *   GET /dashboard/org/summary|timeseries         System Admin: whole organisation + per-department breakdown
 *   GET /admin/audit                              System Admin: the append-only admin audit trail
 *
 * Department and organisation dashboards read the pre-aggregated counters
 * (EventCounter for totals and platforms, CategoryCounter for categories) and
 * never write. Days are UTC calendar days.
 */

export const ANALYTICS_MAX_RANGE_DAYS = 366;
export const ANALYTICS_DEFAULT_RANGE_DAYS = 30;
/** The personal dashboard reads live log rows, so it covers at most 90 days (decision 26). */
export const OWN_DASHBOARD_MAX_DAYS = 90;

/** A real calendar day (2026-02-30 is refused) from 1970 on. */
export function isRealDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getUTCFullYear() >= 1970;
}

const isoDay = z.string().refine(isRealDay, 'analytics.day_invalid');

/** AnalyticsQuery. `from`/`to` are inclusive UTC days; the default is the last 30 days. */
export const AnalyticsQuerySchema = z
  .object({
    from: isoDay.optional(),
    to: isoDay.optional(),
    /** System Admin only, on /dashboard/department/*. */
    department_id: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const bad = (m: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: m });
    // Each day is already validated by the field schema; the span (with the
    // defaults applied) is checked again in the service.
    if (q.from && q.to) {
      const days = (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000;
      if (days < 0) bad('analytics.range_invalid');
      if (days >= ANALYTICS_MAX_RANGE_DAYS) bad('analytics.range_too_long');
    }
  });
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

export const DashboardScopeSchema = z.enum(['OWN', 'DEPARTMENT', 'ORG']);
export type DashboardScope = z.infer<typeof DashboardScopeSchema>;

export const DashboardTotalsSchema = z.object({
  /** All recorded events in the range, NONE risk included (decision 10). */
  total_events: z.number().int().nonnegative(),
  /** WARNED + BLOCKED: the prompts the product intercepted. */
  intercepted: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  warned: z.number().int().nonnegative(),
  allowed: z.number().int().nonnegative(),
  high_risk: z.number().int().nonnegative(),
  /** Share of HIGH events among all events, 0..100 with one decimal. */
  high_risk_percent: z.number().min(0).max(100),
  /** Share of WARNED/BLOCKED events the user submitted anyway, 0..100 (WEB-FR-066). */
  override_rate_percent: z.number().min(0).max(100),
});
export type DashboardTotals = z.infer<typeof DashboardTotalsSchema>;

export const PlatformCountSchema = z.object({ platform: PlatformSchema, count: z.number().int().nonnegative() });
export const CategoryCountSchema = z.object({ category_code: CategoryCodeSchema, count: z.number().int().nonnegative() });

/** Per-department risk distribution (System Admin only; WEB-FR-029). */
export const DepartmentBreakdownSchema = z.object({
  department_id: z.string().uuid().nullable(),
  department_name: z.string().nullable(),
  total: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  none: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  warned: z.number().int().nonnegative(),
});
export type DepartmentBreakdown = z.infer<typeof DepartmentBreakdownSchema>;

export const DashboardSummaryResponseSchema = z.object({
  scope: DashboardScopeSchema,
  from: isoDay,
  to: isoDay,
  /** Active users in scope (org: all; department: that department; own: 1). */
  total_users: z.number().int().nonnegative(),
  totals: DashboardTotalsSchema,
  /** Most used AI platforms, highest first. */
  platforms: z.array(PlatformCountSchema),
  /** Most frequently detected data categories, highest first (top 10). */
  top_categories: z.array(CategoryCountSchema),
  /** Present for ORG only. */
  departments: z.array(DepartmentBreakdownSchema).optional(),
  /** Counter sync lag, seconds: always 0 for counter reads (they are written at ingestion). */
  lag_seconds: z.number().int().nonnegative(),
});
export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>;

export const TimeseriesPointSchema = z.object({
  day: isoDay,
  total: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  none: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  warned: z.number().int().nonnegative(),
});
export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>;

/** One point per day of the range, zero-filled, ascending (risk-trend chart, WEB-FR-029). */
export const DashboardTimeseriesResponseSchema = z.object({
  scope: DashboardScopeSchema,
  from: isoDay,
  to: isoDay,
  points: z.array(TimeseriesPointSchema),
});
export type DashboardTimeseriesResponse = z.infer<typeof DashboardTimeseriesResponseSchema>;

// ---------- audit trail ----------

export const AUDIT_PAGE_MAX_SIZE = 100;

export const AuditQuerySchema = z
  .object({
    action_type: AuditActionSchema.optional(),
    target_type: AuditTargetTypeSchema.optional(),
    acting_admin_id: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: z.string().min(1).max(200).optional(),
    page_size: z.coerce.number().int().min(1).max(AUDIT_PAGE_MAX_SIZE).default(25),
  })
  .strict()
  .refine((q) => !q.from || !q.to || new Date(q.from) < new Date(q.to), { message: 'audit.range_invalid', path: ['to'] });
export type AuditQuery = z.infer<typeof AuditQuerySchema>;

export const AuditEntryResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  acting_admin_id: z.string().uuid(),
  acting_admin_name: z.string(),
  action_type: AuditActionSchema,
  target_type: AuditTargetTypeSchema,
  target_id: z.string().uuid().nullable(),
  /** Best-effort label of the target (user name, department name, rule name); null when gone or not applicable. */
  target_name: z.string().nullable(),
  detail: AuditDetailSchema.nullable(),
});
export type AuditEntryResponse = z.infer<typeof AuditEntryResponseSchema>;

export const AuditQueryResponseSchema = z.object({
  items: z.array(AuditEntryResponseSchema),
  next_cursor: z.string().nullable(),
});
export type AuditQueryResponse = z.infer<typeof AuditQueryResponseSchema>;
