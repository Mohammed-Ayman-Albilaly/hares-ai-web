import type { DepartmentListResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** All departments (System Admin pickers and the departments screen). */
export function useDepartments(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['departments'],
    queryFn: ({ signal }) => api.get<DepartmentListResponse>('/admin/departments', { signal }),
  });
}
