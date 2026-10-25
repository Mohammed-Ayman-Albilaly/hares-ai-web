import { LoginRequestSchema, type LoginRequest } from '@hares/contract';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { useSession } from '@/auth/AuthProvider';
import { homeFor } from '@/auth/routes';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';
import { AuthHeading, AuthShell, FormAlert } from './AuthShell';

/** Only same-origin paths are accepted as a return address (no open redirect). */
const safeFrom = (from: unknown): string | null => (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null);

export function LoginPage() {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [wait, setWait] = useState(0); // seconds left of a throttle delay
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(LoginRequestSchema, () => t), mode: 'onSubmit' });

  useEffect(() => () => clearInterval(timer.current), []);

  const startCountdown = (seconds: number) => {
    clearInterval(timer.current);
    setWait(seconds);
    timer.current = setInterval(() => {
      setWait((w) => {
        if (w <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return w - 1;
      });
    }, 1000);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await session.login(values.email, values.password);
      navigate(safeFrom((location.state as { from?: string } | null)?.from) ?? homeFor(user.role), { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'RATE_LIMITED' && e.retryAfter) {
        startCountdown(e.retryAfter);
        setFormError(null);
      } else {
        setFormError(apiErrorMessage(t, e));
      }
    }
  });

  return (
    <AuthShell title={t('auth.loginTitle')}>
      <AuthHeading title={t('auth.welcomeBack')} subtitle={t('auth.loginSubtitle')} />
      {formError && <FormAlert>{formError}</FormAlert>}
      {wait > 0 && <FormAlert tone="info" quiet>{t('auth.waitBeforeRetry', { seconds: wait })}</FormAlert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          placeholder={t('auth.emailPlaceholder')}
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAction={
            <Link to="/forgot-password" className="text-[12.5px] text-accent no-underline hover:underline">
              {t('auth.forgotLink')}
            </Link>
          }
          {...register('password')}
        />
        <Button type="submit" variant="primary" className="mt-1 py-3" loading={isSubmitting} loadingLabel={t('auth.loggingIn')} disabled={wait > 0}>
          {t('auth.loginSubmit')}
        </Button>
      </form>
      <p className="m-0 mt-[22px] text-center text-[13px] text-ink-3">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium text-accent no-underline hover:underline">
          {t('auth.registerLink')}
        </Link>
      </p>
    </AuthShell>
  );
}
