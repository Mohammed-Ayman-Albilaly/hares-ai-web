/** Date ranges for the dashboards. Days are UTC calendar days, as on the server (B8). */

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** `from`/`to` (inclusive) covering the last `days` days, today included. */
export function rangeParams(days: number, now = new Date()): { from: string; to: string } {
  const to = iso(now);
  const from = iso(new Date(now.getTime() - (days - 1) * DAY_MS));
  return { from, to };
}
