import type { LogListResponse } from '@hares/contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

export type LogFilterValues = {
  from?: string;
  to?: string;
  risk_level?: string;
  platform?: string;
  action?: string;
  user_decision?: string;
  category?: string;
  user_id?: string;
  department_id?: string;
}

function toQuery(filters: Record<string, string | undefined>, pageSize: number, cursor?: string): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  p.set('page_size', String(pageSize));
  if (cursor) p.set('cursor', cursor);
  return p.toString();
}

/**
 * A page of the log list with Previous/Next. The server pages by keyset cursor
 * (it can only go forward), so the cursors of the pages already seen are kept
 * in a stack and going back pops one. Changing a filter returns to page 1.
 */
export function useKeysetList<R extends { next_cursor: string | null }>(
  kind: string,
  base: string,
  filters: Record<string, string | undefined>,
  pageSize = 25,
  enabled = true,
) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState<{ key: string; stack: string[] }>({ key, stack: [] });
  // A new filter always starts at page 1, also when an earlier filter comes back.
  if (state.key !== key) setState({ key, stack: [] });
  const stack = state.key === key ? state.stack : [];
  const cursor = stack[stack.length - 1];

  const query = useQuery({
    queryKey: [kind, base, filters, pageSize, cursor ?? null],
    queryFn: ({ signal }) => api.get<R>(`${base}?${toQuery(filters, pageSize, cursor)}`, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });

  const next = query.data?.next_cursor ?? null;
  return {
    query,
    page: stack.length + 1,
    hasPrev: stack.length > 0,
    hasNext: next !== null,
    goNext: () => next && setState({ key, stack: [...stack, next] }),
    goPrev: () => setState({ key, stack: stack.slice(0, -1) }),
  };
}

/** The log list: a keyset-paged list under the `logs` cache key. */
export const useLogs = (base: string, filters: LogFilterValues, pageSize = 25, enabled = true) =>
  useKeysetList<LogListResponse>('logs', base, filters, pageSize, enabled);
