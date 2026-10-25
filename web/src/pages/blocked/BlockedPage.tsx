import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { LogsView } from '@/features/logs/LogsView';

/** USER screen 3: "Blocked messages" is the same log with the action fixed to BLOCKED (WEB-FR-022). */
export function BlockedPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('nav.blocked')} crumb={t('navGroup.personal')}>
      <LogsView
        base="/logs/mine"
        fixed={{ action: 'BLOCKED' }}
        hideActionFilter
        emptyTitle={t('logs.blockedEmptyTitle')}
        emptyBody={t('logs.blockedEmptyBody')}
      />
    </Page>
  );
}
