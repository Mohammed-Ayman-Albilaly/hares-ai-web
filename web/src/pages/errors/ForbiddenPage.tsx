import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor } from '@/auth/routes';
import { ButtonLink } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';

/** Shown inside the shell when the signed-in role may not open a screen. The API refuses the data as well. */
export function ForbiddenPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <div className="card flex max-w-md flex-col items-center gap-3 p-10 text-center" role="alert">
        <div className="grid size-11 place-items-center rounded-xl bg-surface-3 text-ink-3">
          <I.Lock size={20} />
        </div>
        <h1 className="m-0 text-xl font-semibold">{t('app.forbiddenTitle')}</h1>
        <p className="m-0 text-[13.5px] text-ink-3">{t('app.forbiddenBody')}</p>
        <ButtonLink to={homeFor(auth.user?.role ?? null)} variant="primary" className="mt-2">
          {t('app.goHome')}
        </ButtonLink>
      </div>
    </div>
  );
}
