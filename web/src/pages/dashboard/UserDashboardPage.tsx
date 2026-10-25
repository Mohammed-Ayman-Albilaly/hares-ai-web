import type { LogListResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { ButtonLink } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/layout';
import { DataState, TableSkeleton } from '@/components/ui/states';
import { DashboardView } from '@/features/analytics/DashboardView';
import { LogTable } from '@/features/logs/LogTable';
import { api } from '@/lib/api';

/** The last few events, as a compact table (the full log is on /activity). */
function RecentActivity() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['logs', '/logs/mine', 'recent'],
    queryFn: ({ signal }) => api.get<LogListResponse>('/logs/mine?page_size=6', { signal }),
  });
  const items = q.data?.items ?? [];
  if (q.isSuccess && items.length === 0) return null;
  return (
    <Section
      title={t('dash.recent')}
      sub={t('dash.recentSub')}
      actions={
        <ButtonLink to="/activity" variant="ghost">
          {t('dash.viewAll')}
        </ButtonLink>
      }
    >
      <DataState isLoading={q.isLoading} isError={q.isError} error={q.error} refetch={() => void q.refetch()} skeleton={<TableSkeleton rows={4} />}>
        <Card padded={false}>
          <LogTable items={items} compact />
        </Card>
      </DataState>
    </Section>
  );
}

/** USER screen 1: own statistics for 7/30/90 days (WEB-FR-028, 033). */
export function UserDashboardPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('nav.dashboard')} crumb={t('navGroup.personal')}>
      <DashboardView base="/dashboard/mine" emptyTitle={t('dash.noActivityTitle')} emptyBody={t('dash.noActivityBody')}>
        <RecentActivity />
      </DashboardView>
    </Page>
  );
}
