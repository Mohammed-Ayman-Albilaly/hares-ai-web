import type { UserListResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { SelectField } from '@/components/ui/SelectField';
import { DepartmentRisk } from '@/features/analytics/charts';
import { DashboardView } from '@/features/analytics/DashboardView';
import { DepartmentSelect } from '@/features/common/DepartmentSelect';
import { LogsView } from '@/features/logs/LogsView';
import { api } from '@/lib/api';

/** System Admin screen: the whole organisation, with the risk split per department (WEB-FR-029). */
export function AdminDashboardPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('nav.adminDashboard')} group="organization">
      <DashboardView base="/dashboard/org" emptyTitle={t('dash.noOrgActivityTitle')} emptyBody={t('dash.noOrgActivityBody')}>
        {(_days, summary) => (summary?.departments && summary.departments.length > 0 ? <DepartmentRisk departments={summary.departments} /> : null)}
      </DashboardView>
    </Page>
  );
}

/** The organisation's log: filter by department and user, export CSV (WEB-FR-021, 024, 066). */
export function AdminLogsPage() {
  const { t } = useTranslation();
  const [departmentId, setDepartmentId] = useState('');
  const [userId, setUserId] = useState('');
  const users = useQuery({
    queryKey: ['users', 'picker', departmentId],
    queryFn: ({ signal }) =>
      api.get<UserListResponse>(`/admin/users?page_size=100${departmentId ? `&department_id=${departmentId}` : ''}`, { signal }),
  });
  return (
    <Page title={t('nav.adminLogs')} group="organization">
      <LogsView
        base="/admin/logs"
        exportPath="/admin/logs/export"
        showUser
        onClearExtra={() => {
          setDepartmentId('');
          setUserId('');
        }}
        extraValues={{ ...(departmentId ? { department_id: departmentId } : {}), ...(userId ? { user_id: userId } : {}) }}
        extraFilters={
          <>
            <DepartmentSelect
              label={t('logs.department')}
              value={departmentId}
              placeholder={t('logs.all')}
              onChange={(v) => {
                setDepartmentId(v);
                setUserId('');
              }}
            />
            <SelectField
              label={t('logs.user')}
              value={userId}
              disabled={users.isLoading}
              onChange={(e) => setUserId(e.target.value)}
              aria-describedby={users.isError ? 'a-user-err' : undefined}
            >
              <option value="">{t('logs.all')}</option>
              {(users.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
              {users.data && users.data.total > users.data.items.length && (
                <option disabled>{t('logs.firstUsersOnly', { count: users.data.items.length })}</option>
              )}
            </SelectField>
            {users.isError && (
              <div id="a-user-err" className="err w-full" role="alert">
                {t('logs.userListError')}
              </div>
            )}
          </>
        }
        emptyTitle={t('logs.orgEmptyTitle')}
        emptyBody={t('logs.orgEmptyBody')}
      />
    </Page>
  );
}
