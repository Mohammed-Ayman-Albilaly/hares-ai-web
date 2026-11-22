import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor } from '@/auth/routes';
import { ButtonLink } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Logo';
import { Card } from '@/components/ui/layout';

/**
 * Shown inside the shell when the signed-in role may not open a screen (the API refuses the data as
 * well). It is a page, not an alert: the same card, mark and display heading as the 404 screen, and a
 * way home that knows the role, so the link never leads to a screen that role cannot open.
 */
export function ForbiddenPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  // The tab, and with it the route announcement, must name this screen rather than the one the user came from.
  useEffect(() => {
    document.title = `${t('app.forbiddenTitle')} · ${t('app.name')}`;
  }, [t]);
  return (
    // A page body needs its landmark, and the shell's skip link targets #main.
    <main id="main" tabIndex={-1} className="content outline-none">
      <div className="grid min-h-[60dvh] place-items-center">
        <Card className="w-full max-w-[440px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Wordmark />
            <div className="num-display mt-4 text-[56px] leading-none text-ink-4">403</div>
            <h1 className="display m-0 text-xl text-ink">{t('app.forbiddenTitle')}</h1>
            <p className="m-0 text-[13.5px] leading-relaxed text-ink-3">{t('app.forbiddenBody')}</p>
            <ButtonLink to={homeFor(auth.user?.role ?? null)} variant="primary" className="mt-2">
              {t('app.goHome')}
            </ButtonLink>
          </div>
        </Card>
      </div>
    </main>
  );
}
