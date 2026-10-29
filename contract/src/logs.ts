import { z } from 'zod';
import {
  CategoryCodeSchema,
  ClassificationSourceSchema,
  LogActionSchema,
  PlatformSchema,
  RiskLevelSchema,
  UserDecisionSchema,
} from './enums';

/**
 * Log review, filters and CSV export (batch B7b; WEB-FR-021..027, 066, decision 16).
 * All JSON fields are snake_case. No prompt text exists anywhere in these shapes.
 *
 *   GET /logs/mine                 -> LogListResponse   own events (any role); `action=BLOCKED` is "Blocked Messages"
 *   GET /admin/logs                -> LogListResponse   System Admin: organisation; Department Admin: own department
 *   GET /admin/logs/:log_id        -> LogDetail         same scope, otherwise 404
 *   GET /admin/logs/export         -> text/csv          administrators only, same filters, streamed
 *
 * Lists use keyset pagination on (event_time DESC, log_id DESC): the answer's
 * `next_cursor` is passed back as `cursor`. Retention keeps 90 days (decision 11).
 */

export const LOG_PAGE_MAX_SIZE = 100;
export const LOG_PAGE_DEFAULT_SIZE = 25;
/** Safety cap on one CSV export (rows); the file is truncated beyond it. */
export const CSV_EXPORT_MAX_ROWS = 100_000;

const isoDate = z.string().datetime();

/** Filters shared by the list endpoints and the export (WEB-FR-024, 066). */
const filterShape = {
  /** Inclusive lower bound on event_time. */
  from: isoDate.optional(),
  /** Exclusive upper bound on event_time. */
  to: isoDate.optional(),
  risk_level: RiskLevelSchema.optional(),
  platform: PlatformSchema.optional(),
  action: LogActionSchema.optional(),
  user_decision: UserDecisionSchema.optional(),
  /** Events that matched this data category. */
  category: CategoryCodeSchema.optional(),
  rule_id: z.string().uuid().optional(),
};

const rangeOk = (q: { from?: string; to?: string }) => !q.from || !q.to || new Date(q.from) < new Date(q.to);
const rangeIssue = { message: 'logs.range_invalid', path: ['to'] };

/** Query of GET /logs/mine: the caller's own events. */
export const OwnLogQuerySchema = z
  .object({
    ...filterShape,
    cursor: z.string().min(1).max(200).optional(),
    page_size: z.coerce.number().int().min(1).max(LOG_PAGE_MAX_SIZE).default(LOG_PAGE_DEFAULT_SIZE),
  })
  .strict()
  .refine(rangeOk, rangeIssue);
export type OwnLogQuery = z.infer<typeof OwnLogQuerySchema>;

/** Query of GET /admin/logs (LogQuery). `department_id` is honoured for a System Admin only. */
export const LogQuerySchema = z
  .object({
    ...filterShape,
    user_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    cursor: z.string().min(1).max(200).optional(),
    page_size: z.coerce.number().int().min(1).max(LOG_PAGE_MAX_SIZE).default(LOG_PAGE_DEFAULT_SIZE),
  })
  .strict()
  .refine(rangeOk, rangeIssue);
export type LogQuery = z.infer<typeof LogQuerySchema>;

/** Query of the CSV export: the same filters, no paging. */
export const LogExportQuerySchema = z
  .object({
    ...filterShape,
    user_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
  })
  .strict()
  .refine(rangeOk, rangeIssue);
export type LogExportQuery = z.infer<typeof LogExportQuerySchema>;

/** One row of the log table (WEB-FR-026): timestamp, user, categories, risk, platform, action, decision. */
export const LogListItemSchema = z.object({
  log_id: z.string().uuid(),
  event_time: z.string().datetime(),
  user_id: z.string().uuid(),
  user_name: z.string(),
  department_id: z.string().uuid().nullable(),
  department_name: z.string().nullable(),
  platform: PlatformSchema,
  risk_level: RiskLevelSchema,
  action: LogActionSchema,
  user_decision: UserDecisionSchema,
  categories: z.array(CategoryCodeSchema),
  /** Name of the custom rule that matched (its current name), for events caught by a rule; null otherwise. */
  rule_name: z.string().nullable(),
});
export type LogListItem = z.infer<typeof LogListItemSchema>;

export const LogListResponseSchema = z.object({
  items: z.array(LogListItemSchema),
  /** Pass as `cursor` for the next page; null on the last page. */
  next_cursor: z.string().nullable(),
});
export type LogListResponse = z.infer<typeof LogListResponseSchema>;

export const LogDetailSchema = LogListItemSchema.extend({
  user_email: z.string(),
  classification_source: ClassificationSourceSchema,
  rule_id: z.string().uuid().nullable(),
  schema_version: z.number().int().positive(),
  received_at: z.string().datetime(),
});
export type LogDetail = z.infer<typeof LogDetailSchema>;

/** CSV columns, in order (CsvExportResponse headers). Metadata only. */
export const CSV_COLUMNS = [
  'log_id',
  'event_time',
  'user_name',
  'user_email',
  'department',
  'platform',
  'risk_level',
  'action',
  'user_decision',
  'categories',
  'classification_source',
  'rule_id',
] as const;
export const CsvExportResponseSchema = z.object({
  content_type: z.literal('text/csv; charset=utf-8'),
  columns: z.tuple([
    z.literal('log_id'),
    z.literal('event_time'),
    z.literal('user_name'),
    z.literal('user_email'),
    z.literal('department'),
    z.literal('platform'),
    z.literal('risk_level'),
    z.literal('action'),
    z.literal('user_decision'),
    z.literal('categories'),
    z.literal('classification_source'),
    z.literal('rule_id'),
  ]),
});
export type CsvExportResponse = z.infer<typeof CsvExportResponseSchema>;

export const LOG_ERROR_CODES = [
  'LOG_NOT_FOUND', // 404 (also for a log outside the caller's scope: no existence oracle)
  'INVALID_CURSOR', // 400
] as const;
export const LogErrorCodeSchema = z.enum(LOG_ERROR_CODES);
export type LogErrorCode = z.infer<typeof LogErrorCodeSchema>;
