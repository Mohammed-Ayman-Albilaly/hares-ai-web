import type { DashboardSummaryResponse, DashboardTimeseriesResponse } from '@hares/contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { rangeParams } from './range';

/**
 * Summary + daily series of one dashboard scope.
 * `base` is `/dashboard/mine`, `/dashboard/department` or `/dashboard/org`.
 * `extra` carries scope filters such as `department_id` (System Admin).
 */
export function useDashboard(base: string, days: number, extra: Record<string, string> = {}) {
  // One range per render pass so both requests use the same days.
  const params = { ...rangeParams(days), ...extra };
  const qs = new URLSearchParams(params).toString();
  const summary = useQuery({
    queryKey: ['dashboard', base, 'summary', params],
    queryFn: ({ signal }) => api.get<DashboardSummaryResponse>(`${base}/summary?${qs}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const series = useQuery({
    queryKey: ['dashboard', base, 'timeseries', params],
    queryFn: ({ signal }) => api.get<DashboardTimeseriesResponse>(`${base}/timeseries?${qs}`, { signal }),
    placeholderData: keepPreviousData,
  });
  return { summary, series };
}
