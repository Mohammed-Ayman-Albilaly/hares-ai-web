import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { EmptyState } from '@/components/ui/states';
import { I } from '@/components/ui/icons';

/** Stand-in for a role screen that a later batch fills in. */
export function HomePlaceholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Page title={t(titleKey)}>
      <EmptyState title={t(titleKey)} body={t('app.comingSoon')} icon={<I.Dashboard size={20} />} />
    </Page>
  );
}
