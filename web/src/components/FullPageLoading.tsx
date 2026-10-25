import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';

export function FullPageLoading() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <Logo size={44} />
        <div className="skeleton" style={{ height: 6, width: 120 }} aria-hidden="true" />
        <span className="sr-only">{t('app.loading')}</span>
      </div>
    </div>
  );
}
