import { RegisterRequestSchema, type RegisterResponse } from '@hares/contract';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button, ButtonLink } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';
import { AuthHeading, AuthShell, FormAlert } from './AuthShell';

/** The contract's rules plus a "type it twice" check that exists only in the form. */
const FormSchema = z
  .object({ ...RegisterRequestSchema.shape, confirm: z.string().min(1) })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'auth.passwordMismatch' });
type FormValues = z.infer<typeof FormSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema, () => t) });

  const password = watch('password') ?? '';

  const onSubmit = handleSubmit(async ({ full_name, email, password: pw }) => {
    setFormError(null);
    try {
      await api.post<RegisterResponse>('/auth/register', { full_name, email, password: pw }, { auth: false });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_TAKEN') {
        setError('email', { message: t('errors.EMAIL_TAKEN') }, { shouldFocus: true });
      } else {
        setFormError(apiErrorMessage(t, e));
      }
    }
  });

  if (done) {
    return (
      <AuthShell
        title={t('auth.pendingTitle')}
        icon={
          <div className="grid size-12 place-items-center rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <I.Check size={22} />
          </div>
        }
      >
        <AuthHeading title={t('auth.pendingTitle')} />
        <p className="m-0 mb-2 text-center text-[13.5px] leading-relaxed text-ink-3">{t('auth.pendingBody')}</p>
        <p className="m-0 mb-6 text-center text-[13.5px] leading-relaxed text-ink-3">{t('auth.pendingNext')}</p>
        <ButtonLink to="/login" variant="secondary" className="w-full py-3">
          {t('auth.backToLogin')}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.registerTitle')} width={460}>
      <AuthHeading title={t('auth.createAccount')} subtitle={t('auth.registerSubtitle')} />
      {formError && <FormAlert>{formError}</FormAlert>}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="text-[11.5px] font-medium text-ink-4">{t('auth.sectionIdentity')}</div>
        <TextField label={t('auth.fullName')} autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="mt-2 text-[11.5px] font-medium text-ink-4">{t('auth.sectionSecurity')}</div>
        <div>
          <TextField label={t('auth.password')} type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <PasswordStrength password={password} />
        </div>
        <TextField
          label={t('auth.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" variant="primary" className="mt-1 py-3" loading={isSubmitting} loadingLabel={t('auth.registering')}>
          {t('auth.registerSubmit')}
        </Button>
      </form>
      <p className="m-0 mt-[22px] text-center text-[13px] text-ink-3">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-accent no-underline hover:underline">
          {t('auth.loginLink')}
        </Link>
      </p>
    </AuthShell>
  );
}
