import { ForgotPasswordRequestSchema, type ForgotPasswordRequest } from '@hares/contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';
import { AuthHeading, AuthShell, FormAlert } from './AuthShell';

/**
 * WEB-FR-007. The answer is the same for a registered and an unknown email
 * (decision 29), so the screen never says whether the account exists.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequest>({ resolver: zodResolver(ForgotPasswordRequestSchema, () => t) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/auth/forgot-password', values, { auth: false });
      setSent(true);
    } catch (e) {
      setFormError(apiErrorMessage(t, e));
    }
  });

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      icon={
        <div className="grid size-12 place-items-center rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          {sent ? <I.Check size={22} /> : <I.Mail size={22} />}
        </div>
      }
    >
      {sent ? (
        <>
          <AuthHeading title={t('auth.inboxTitle')} />
          <p className="m-0 mb-6 text-center text-[13.5px] leading-relaxed text-ink-3" role="status">
            {t('auth.forgotDone')}
          </p>
          <Button variant="secondary" className="w-full py-3" onClick={() => setSent(false)}>
            {t('auth.sendAnother')}
          </Button>
        </>
      ) : (
        <>
          <AuthHeading title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')} />
          {formError && <FormAlert>{formError}</FormAlert>}
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <TextField
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" variant="primary" className="py-3" loading={isSubmitting} loadingLabel={t('auth.forgotSending')}>
              {t('auth.forgotSubmit')}
            </Button>
          </form>
        </>
      )}
      <p className="m-0 mt-[22px] text-center text-[13px] text-ink-3">
        <Link to="/login" className="text-ink-3 no-underline hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}
