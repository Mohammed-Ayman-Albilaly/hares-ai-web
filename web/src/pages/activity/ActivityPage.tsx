import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { LogsView } from '@/features/logs/LogsView';

/** USER screen 2: the user's own activity log with filters (WEB-FR-021, 024, 026). */
export function ActivityPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('nav.activity')} crumb={t('navGroup.personal')}>
      <LogsView base="/logs/mine" emptyTitle={t('logs.emptyTitle')} emptyBody={t('logs.emptyBody')} />
    </Page>
  );
}
