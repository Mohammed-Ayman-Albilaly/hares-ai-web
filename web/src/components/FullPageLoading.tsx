import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';

/** The first paint while the session is restored: a mark and a bar, and one status region that says so once. */
export function FullPageLoading() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Logo size={44} />
        <div className="skeleton" style={{ height: 6, width: 120 }} aria-hidden="true" />
        {/* The only live region on the screen and it holds one sentence: the mark and the bar are decoration. */}
        <span role="status" aria-live="polite" className="sr-only">
          {t('app.loading')}
        </span>
      </div>
    </div>
  );
}
