import type { AdminUserResponse, CustomRuleListResponse, DepartmentPolicyResponse, UserListResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { Page } from '@/components/Page';
import { SelectField } from '@/components/ui/SelectField';
import { I } from '@/components/ui/icons';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { DashboardView } from '@/features/analytics/DashboardView';
import { TopRiskyUsers } from '@/features/analytics/TopRiskyUsers';
import { LogsView } from '@/features/logs/LogsView';
import { PolicyTable } from '@/features/policy/PolicyTable';
import { RulesTable } from '@/features/policy/RulesTable';
import { DeactivateButton } from '@/features/users/DeactivateButton';
import { UsersView } from '@/features/users/UsersView';
import { api } from '@/lib/api';

/** Department Admin screen: statistics of the whole department and who needs attention (WEB-FR-029). */
export function DepartmentDashboardPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('nav.deptDashboard')} crumb={t('navGroup.department')}>
      <DashboardView base="/dashboard/department" emptyTitle={t('dash.noDeptActivityTitle')} emptyBody={t('dash.noDeptActivityBody')}>
        {(days) => <TopRiskyUsers days={days} />}
      </DashboardView>
    </Page>
  );
}

/** The department's log with a user filter and CSV export (WEB-FR-021, 024, 066). */
export function DepartmentLogsPage() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  const users = useQuery({
    queryKey: ['users', 'picker'],
    queryFn: ({ signal }) => api.get<UserListResponse>('/admin/users?page_size=100', { signal }),
  });
  return (
    <Page title={t('nav.deptLogs')} crumb={t('navGroup.department')}>
      <LogsView
        base="/admin/logs"
        exportPath="/admin/logs/export"
        showUser
        onClearExtra={() => setUserId('')}
        extraValues={userId ? { user_id: userId } : {}}
        extraFilters={
          <SelectField label={t('logs.user')} value={userId} onChange={(e) => setUserId(e.target.value)} disabled={users.isLoading} aria-invalid={users.isError || undefined}>
            <option value="">{t('logs.all')}</option>
            {(users.data?.items ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </SelectField>
        }
        emptyTitle={t('logs.deptEmptyTitle')}
        emptyBody={t('logs.deptEmptyBody')}
      />
    </Page>
  );
}

/** The department's people. A Department Admin can only deactivate (WEB-FR-061); everything else is the System Admin's. */
export function DepartmentUsersPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const me = auth.user?.id;
  const canDeactivate = (u: AdminUserResponse) => u.status === 'ACTIVE' && u.role === 'USER' && u.id !== me;
  return (
    <Page title={t('nav.deptUsers')} crumb={t('navGroup.department')}>
      <UsersView
        renderActions={(u) => (canDeactivate(u) ? <DeactivateButton user={u} /> : null)}
        emptyTitle={t('users.deptEmptyTitle')}
        emptyBody={t('users.deptEmptyBody')}
      />
    </Page>
  );
}

function ReadOnlyNote() {
  const { t } = useTranslation();
  return (
    <div className="card flex items-start gap-3 px-4 py-3 text-[13px] text-ink-3" role="note">
      <I.Lock size={16} />
      <span>{t('policy.readOnlyNote')}</span>
    </div>
  );
}

/** The policy that applies to this department: effective action per data category, read-only (WEB-FR-040). */
export function DepartmentPolicyPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const deptId = auth.user?.department_id;
  const q = useQuery({
    queryKey: ['policy', 'department', deptId],
    enabled: Boolean(deptId),
    queryFn: ({ signal }) => api.get<DepartmentPolicyResponse>(`/admin/policy/departments/${deptId}`, { signal }),
  });
  return (
    <Page title={t('nav.deptPolicy')} crumb={t('navGroup.department')}>
      <ReadOnlyNote />
      <DataState
        isLoading={Boolean(deptId) && q.isLoading}
        isError={q.isError}
        error={q.error}
        refetch={() => void q.refetch()}
        skeleton={<TableSkeleton rows={10} />}
      >
        {q.data && <PolicyTable items={q.data.items} />}
      </DataState>
      {!deptId && <EmptyState title={t('policy.noDepartmentTitle')} body={t('policy.noDepartmentBody')} />}
    </Page>
  );
}

/** Detection rules that apply to this department, read-only. */
export function DepartmentRulesPage() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['rules'],
    queryFn: ({ signal }) => api.get<CustomRuleListResponse>('/admin/rules', { signal }),
  });
  const items = q.data?.items ?? [];
  return (
    <Page title={t('nav.deptRules')} crumb={t('navGroup.department')}>
      <ReadOnlyNote />
      <DataState
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        refetch={() => void q.refetch()}
        isEmpty={items.length === 0}
        skeleton={<TableSkeleton rows={5} />}
        empty={<EmptyState title={t('rules.emptyTitle')} body={t('rules.emptyBody')} />}
      >
        <RulesTable items={items} />
      </DataState>
    </Page>
  );
}
