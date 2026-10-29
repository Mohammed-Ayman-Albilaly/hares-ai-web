import { CATEGORY_CODES, type CategoryPolicyEntry, type DepartmentPolicyResponse, type OrgPolicyResponse } from '@hares/contract';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PolicyActionBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/layout';
import { DataState, TableSkeleton } from '@/components/ui/states';
import { useDepartments } from '@/features/common/useDepartments';
import { api } from '@/lib/api';

/**
 * Every data category against the organisation and each active department, read-only: the action in force, or
 * "Off" where the category is not detected. A dot marks a value the department set itself. It reads the same
 * endpoints as the editors, so it never disagrees with them; the cache is refreshed by `invalidateAdmin`.
 */
export function PolicyMatrix() {
  const { t } = useTranslation();
  const departments = useDepartments();
  const active = (departments.data?.items ?? []).filter((d) => d.active);
  const org = useQuery({ queryKey: ['policy', 'org'], queryFn: ({ signal }) => api.get<OrgPolicyResponse>('/admin/policy/org', { signal }) });
  const depts = useQueries({
    queries: active.map((d) => ({
      queryKey: ['policy', 'department', d.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.get<DepartmentPolicyResponse>(`/admin/policy/departments/${d.id}`, { signal }),
    })),
  });

  const loading = departments.isLoading || org.isLoading || depts.some((q) => q.isLoading);
  const failed = departments.isError || org.isError || depts.some((q) => q.isError);
  const error = departments.error ?? org.error ?? depts.find((q) => q.error)?.error;
  const columns: { id: string; name: string; items: CategoryPolicyEntry[] | undefined }[] = [
    { id: 'org', name: t('policy.matrixOrg'), items: org.data?.items },
    ...active.map((d, i) => ({ id: d.id, name: d.name, items: depts[i]?.data?.items })),
  ];
  const cell = (items: CategoryPolicyEntry[] | undefined, code: string, own: boolean) => {
    const e = items?.find((x) => x.category_code === code);
    if (!e) return <span className="text-ink-4">…</span>;
    if (!e.enabled) return <span className="text-ink-4">{t('policy.matrixOff')}</span>;
    return (
      <span className="inline-flex items-center gap-1.5">
        <PolicyActionBadge action={e.action} />
        {own && e.source === 'DEPARTMENT' && <span role="img" aria-label={t('policy.sources.DEPARTMENT')} title={t('policy.sources.DEPARTMENT')}>
            •
          </span>}
      </span>
    );
  };

  return (
    <DataState
      isLoading={loading}
      isError={failed}
      error={error}
      refetch={() => {
        void departments.refetch();
        void org.refetch();
        depts.forEach((q) => void q.refetch());
      }}
      skeleton={<TableSkeleton rows={8} />}
    >
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="h-table">
            <caption className="sr-only">{t('policy.matrixCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('logs.category')}</th>
                {columns.map((c) => (
                  <th key={c.id} scope="col">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORY_CODES.map((code) => (
                <tr key={code}>
                  <th scope="row" className="font-medium text-ink" style={{ textAlign: 'start' }}>
                    {t(`category.${code}`)}
                  </th>
                  {columns.map((c) => (
                    <td key={c.id}>{cell(c.items, code, c.id !== 'org')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DataState>
  );
}
