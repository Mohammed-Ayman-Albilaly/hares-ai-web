import type { TopRiskyUsersResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/components/charts/direction';
import { Avatar, Card, Section } from '@/components/ui/layout';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { useLang } from '@/i18n/useLang';
import { api } from '@/lib/api';
import { rangeParams } from './range';

/** Users of the department with the most HIGH-risk events (live rows, at most the last 90 days). */
export function TopRiskyUsers({ days, extra = {} }: { days: number; extra?: Record<string, string> }) {
  const { t } = useTranslation();
  const lang = useLang();
  const params = { ...rangeParams(days), ...extra };
  const q = useQuery({
    queryKey: ['dashboard', 'department', 'top-users', params],
    queryFn: ({ signal }) =>
      api.get<TopRiskyUsersResponse>(`/dashboard/department/top-users?${new URLSearchParams(params).toString()}`, { signal }),
  });
  const users = q.data?.users ?? [];
  return (
    <Section title={t('dash.topUsers')} sub={t('dash.topUsersSub')}>
      <DataState
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        refetch={() => void q.refetch()}
        isEmpty={users.length === 0}
        skeleton={<TableSkeleton rows={3} />}
        empty={<EmptyState title={t('dash.noRiskyUsers')} body={t('dash.noRiskyUsersBody')} />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="h-table">
              <caption className="sr-only">{t('dash.topUsers')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('users.user')}</th>
                  <th scope="col">{t('dash.highEvents')}</th>
                  <th scope="col">{t('dash.blocked')}</th>
                  <th scope="col">{t('dash.warned')}</th>
                  <th scope="col">{t('dash.totalEvents')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.user_name} />
                        <span className="font-medium text-ink">{u.user_name}</span>
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(u.high, lang)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(u.blocked, lang)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(u.warned, lang)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(u.total, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
    </Section>
  );
}
