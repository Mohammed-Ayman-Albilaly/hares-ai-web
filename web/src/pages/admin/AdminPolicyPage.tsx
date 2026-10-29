import type { DepartmentPolicyResponse, OrgPolicyResponse, PolicyCategoryActionRequest } from '@hares/contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { Section } from '@/components/ui/layout';
import { SelectField } from '@/components/ui/SelectField';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { CopyPolicy } from '@/features/policy/CopyPolicy';
import { PolicyEditor } from '@/features/policy/PolicyEditor';
import { PolicyMatrix } from '@/features/policy/PolicyMatrix';
import { api } from '@/lib/api';

/**
 * Organisation policy and department overrides (WEB-FR-035..041). Each save
 * bumps the policy version on the server, which is how the extension notices
 * the change; an override can be removed to fall back to the organisation.
 */
export function AdminPolicyPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const departments = useDepartments();
  const [departmentId, setDepartmentId] = useState('');

  const org = useQuery({ queryKey: ['policy', 'org'], queryFn: ({ signal }) => api.get<OrgPolicyResponse>('/admin/policy/org', { signal }) });
  const dept = useQuery({
    queryKey: ['policy', 'department', departmentId],
    enabled: Boolean(departmentId),
    queryFn: ({ signal }) => api.get<DepartmentPolicyResponse>(`/admin/policy/departments/${departmentId}`, { signal }),
  });

  const refresh = () => invalidateAdmin(qc);
  const saveOrg = async (category: string, body: PolicyCategoryActionRequest) => {
    await api.put(`/admin/policy/org/${category}`, body);
    await refresh();
  };
  const saveDept = async (category: string, body: PolicyCategoryActionRequest) => {
    await api.put(`/admin/policy/departments/${departmentId}/${category}`, body);
    await refresh();
  };
  const resetDept = async (category: string) => {
    await api.delete(`/admin/policy/departments/${departmentId}/${category}`);
    await refresh();
  };

  return (
    <Page title={t('nav.adminPolicy')} crumb={t('navGroup.organization')}>
      <Section title={t('policy.orgTitle')} sub={org.data ? t('policy.version', { version: org.data.version }) : undefined}>
        <DataState isLoading={org.isLoading} isError={org.isError} error={org.error} refetch={() => void org.refetch()} skeleton={<TableSkeleton rows={10} />}>
          {org.data && <PolicyEditor items={org.data.items} save={saveOrg} />}
        </DataState>
      </Section>

      <Section title={t('policy.deptTitle')} sub={t('policy.deptSub')}>
        <div className="max-w-sm">
          <SelectField label={t('logs.department')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={departments.isLoading}>
            <option value="">{t('manage.chooseDepartment')}</option>
            {(departments.data?.items ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
        </div>
        {!departmentId ? (
          <EmptyState title={t('policy.pickDepartmentTitle')} body={t('policy.pickDepartmentBody')} />
        ) : (
          <DataState isLoading={dept.isLoading} isError={dept.isError} error={dept.error} refetch={() => void dept.refetch()} skeleton={<TableSkeleton rows={10} />}>
            {dept.data && <PolicyEditor key={departmentId} items={dept.data.items} save={saveDept} reset={resetDept} />}
          </DataState>
        )}
      </Section>

      <Section title={t('policy.matrixTitle')} sub={t('policy.matrixSub')}>
        <PolicyMatrix />
      </Section>

      <Section title={t('policy.copyTitle')} sub={t('policy.copySub')}>
        <CopyPolicy />
      </Section>
    </Page>
  );
}
