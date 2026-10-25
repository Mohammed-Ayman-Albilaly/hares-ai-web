import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Logo';

/**
 * Shown when a screen cannot be loaded or crashes. The usual cause is an open tab from before a new
 * version was deployed (the old screen file is gone), and a reload fixes it.
 */
export function RouteError() {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="card flex max-w-md flex-col items-center gap-4 p-8 text-center" role="alert">
        <Wordmark />
        <h1 className="m-0 text-xl font-semibold">{t('app.errorTitle')}</h1>
        <p className="m-0 text-[13.5px] text-ink-3">{t('app.errorBody')}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t('app.reload')}
        </Button>
      </div>
    </div>
  );
}
