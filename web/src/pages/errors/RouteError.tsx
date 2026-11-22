import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor } from '@/auth/routes';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Logo';

/**
 * Shown when a screen cannot be loaded or crashes. The usual cause is an open tab from before a new
 * version was deployed (the old screen file is gone) and a reload fixes it; the way home is here as well,
 * because a reload does not help a user whose session is fine and only that screen is broken.
 */
export function RouteError() {
  const { t } = useTranslation();
  const auth = useAuth();
  const home = auth.status === 'authenticated' ? homeFor(auth.user.role) : '/';
  // The tab must name the failure, not the screen the user was on when it happened.
  useEffect(() => {
    document.title = `${t('app.errorTitle')} · ${t('app.name')}`;
  }, [t]);
  return (
    // A full page needs its landmark, even though the shell (and its skip link) is gone at this point.
    <main className="grid min-h-dvh place-items-center bg-bg p-6">
      {/* An unexpected failure interrupts the user, so it is announced as an alert (like the inline error state). */}
      <div className="card flex w-full max-w-[440px] flex-col items-center gap-3 p-8 text-center" role="alert">
        <Wordmark />
        <h1 className="display m-0 text-xl text-ink">{t('app.errorTitle')}</h1>
        <p className="m-0 text-[13.5px] leading-relaxed text-ink-3">{t('app.errorBody')}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('app.reload')}
          </Button>
          <ButtonLink to={home} variant="secondary">
            {t('app.goHome')}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
