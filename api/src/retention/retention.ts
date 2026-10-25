/** Activity-log detail rows are kept 90 days, by event_time (decisions 11 and 33). */
export const RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

/** Start (00:00 UTC) of the UTC day that contains `d`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Math.floor(d.getTime() / DAY_MS) * DAY_MS);
}

/**
 * Rows with an event_time BEFORE this instant are purged: midnight UTC of the
 * day that is 90 days back. Cutting at a day boundary (rather than at the exact
 * instant) means a counter day is either fully backed by detail rows or fully
 * purged, never half of each, which keeps the reconcile job and the purge from
 * ever disagreeing about a day. Detail rows therefore live between 90 and 91
 * days.
 */
export function purgeBoundary(now = new Date()): Date {
  return startOfUtcDay(new Date(now.getTime() - RETENTION_DAYS * DAY_MS));
}

/**
 * First UTC day the reconcile job may recompute: strictly AFTER the purge
 * boundary day. The boundary day itself is deleted by the next day's purge, so
 * its counter must not be recomputed from rows that are about to disappear.
 */
export function reconcileFromDay(now = new Date()): string {
  return new Date(purgeBoundary(now).getTime() + DAY_MS).toISOString().slice(0, 10);
}
