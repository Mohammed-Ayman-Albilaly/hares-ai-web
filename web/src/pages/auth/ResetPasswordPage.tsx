import { PasswordSchema } from '@hares/contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';
import { AuthHeading, AuthShell, FormAlert } from './AuthShell';

const FormSchema = z
  .object({ new_password: PasswordSchema, confirm: z.string().min(1) })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'auth.passwordMismatch' });
type FormValues = z.infer<typeof FormSchema>;

/**
 * Reads the single-use token from the URL fragment (`#token=...`), then removes
 * it from the address bar and history so it is not left lying around. The
 * fragment is never sent to a server or in a Referer header (decision 41).
 */
function takeToken(): string | null {
  const m = /(?:^#|&)token=([A-Za-z0-9_-]{43})(?:&|$)/.exec(window.location.hash);
  if (m) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  return m ? m[1] : null;
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [token] = useState(takeToken); // read once: the fragment is removed right away
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema, () => t) });

  const password = watch('new_password') ?? '';

  const onSubmit = handleSubmit(async ({ new_password }) => {
    if (!token) return;
    setFormError(null);
    try {
      await api.post('/auth/reset-password', { token, new_password }, { auth: false });
      setDone(true);
    } catch (e) {
      setFormError(apiErrorMessage(t, e));
    }
  });

  if (!token && !done) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <AuthHeading title={t('auth.resetTitle')} />
        <FormAlert>{t('auth.resetMissingToken')}</FormAlert>
        <ButtonLink to="/forgot-password" variant="primary" className="w-full py-3">
          {t('auth.requestNewLink')}
        </ButtonLink>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <AuthHeading title={t('auth.resetTitle')} />
        <FormAlert tone="info">{t('auth.resetDone')}</FormAlert>
        <ButtonLink to="/login" variant="primary" className="w-full py-3">
          {t('auth.loginSubmit')}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.resetTitle')}>
      <AuthHeading title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')} />
      {formError && <FormAlert>{formError}</FormAlert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <TextField label={t('auth.newPassword')} type="password" autoComplete="new-password" error={errors.new_password?.message} {...register('new_password')} />
          <PasswordStrength password={password} />
        </div>
        <TextField label={t('auth.confirmPassword')} type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" variant="primary" className="py-3" loading={isSubmitting} loadingLabel={t('auth.resetting')}>
          {t('auth.resetSubmit')}
        </Button>
      </form>
      <p className="m-0 mt-[22px] text-center text-[13px] text-ink-3">
        <Link to="/login" className="text-ink-3 no-underline hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}
