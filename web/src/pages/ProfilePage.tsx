import { ChangePasswordRequestSchema, type LoginResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSession } from '@/auth/AuthProvider';
import { Page } from '@/components/Page';
import { Button } from '@/components/ui/Button';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { TextField } from '@/components/ui/TextField';
import { RoleBadge, StatusBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/layout';
import { DataState, TableSkeleton } from '@/components/ui/states';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';
import type { ProfileResponse } from '@hares/contract';

const FormSchema = z
  .object({ ...ChangePasswordRequestSchema.shape, confirm: z.string().min(1) })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'auth.passwordMismatch' });
type FormValues = z.infer<typeof FormSchema>;

/** WEB-FR-057 (view profile) and WEB-FR-058 (change own password; ends other sessions, keeps this one). */
export function ProfilePage() {
  const { t } = useTranslation();
  const session = useSession();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.get<ProfileResponse>('/profile') });
  const [ok, setOk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema, () => t) });
  const newPassword = watch('new_password') ?? '';

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    setOk(false);
    setFormError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/change-password', { current_password, new_password });
      session.adopt(res); // the new session for this device
      reset();
      setOk(true);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'INVALID_CURRENT_PASSWORD') setError('current_password', { message: t('errors.INVALID_CURRENT_PASSWORD') }, { shouldFocus: true });
      else setFormError(apiErrorMessage(t, e));
    }
  });

  const p = profile.data;
  return (
    <Page title={t('profile.title')} narrow>
      <DataState
        isLoading={profile.isLoading}
        isError={profile.isError}
        error={profile.error}
        refetch={() => void profile.refetch()}
        skeleton={<TableSkeleton rows={4} />}
      >
        {p && (
          <Card>
            <h2 className="m-0 mb-4 text-[14.5px] font-semibold">{t('profile.title')}</h2>
            <dl className="m-0 grid gap-4 sm:grid-cols-2">
              <Item label={t('profile.name')}>{p.full_name}</Item>
              <Item label={t('profile.email')}>
                <span dir="ltr">{p.email}</span>
              </Item>
              <Item label={t('profile.department')}>{p.department?.name ?? t('profile.noDepartment')}</Item>
              <Item label={t('profile.role')}>
                <RoleBadge role={p.role} />
              </Item>
              <Item label={t('profile.status')}>
                <StatusBadge status={p.status} />
              </Item>
            </dl>
          </Card>
        )}
      </DataState>

      <Card>
        <h2 className="m-0 text-[14.5px] font-semibold">{t('profile.changePassword')}</h2>
        <p className="m-0 mb-4 mt-1 text-[12.5px] text-ink-4">{t('profile.changePasswordHint')}</p>
        {ok && (
          <div role="status" className="mb-4 rounded-lg px-3.5 py-3 text-[13px]" style={{ background: 'var(--risk-none-soft)', color: 'var(--risk-none)' }}>
            {t('profile.changed')}
          </div>
        )}
        {formError && (
          <div role="alert" className="mb-4 rounded-lg px-3.5 py-3 text-[13px]" style={{ background: 'var(--risk-high-soft)', color: 'var(--risk-high)' }}>
            {formError}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate className="grid gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label={t('profile.currentPassword')} type="password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
          </div>
          <div>
            <TextField label={t('auth.newPassword')} type="password" autoComplete="new-password" error={errors.new_password?.message} {...register('new_password')} />
            <PasswordStrength password={newPassword} />
          </div>
          <TextField label={t('auth.confirmPassword')} type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="primary" loading={isSubmitting} loadingLabel={t('profile.changing')}>
              {t('profile.changeSubmit')}
            </Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs text-ink-4">{label}</dt>
      <dd className="m-0 text-sm text-ink">{children}</dd>
    </div>
  );
}
