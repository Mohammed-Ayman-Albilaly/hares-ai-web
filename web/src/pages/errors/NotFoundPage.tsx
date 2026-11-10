import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor } from '@/auth/routes';
import { ButtonLink } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Logo';
import { Card } from '@/components/ui/layout';

export function NotFoundPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const home = auth.status === 'authenticated' ? homeFor(auth.user.role) : '/';
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-4 sm:p-6">
      <Card className="w-full max-w-[440px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Wordmark />
          <div className="num-display mt-4 text-[56px] leading-none text-ink-4">404</div>
          <h1 className="display m-0 text-xl text-ink">{t('app.notFoundTitle')}</h1>
          <p className="m-0 text-[13.5px] leading-relaxed text-ink-3">{t('app.notFoundBody')}</p>
          <ButtonLink to={home} variant="primary" className="mt-2">
            {t('app.goHome')}
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
