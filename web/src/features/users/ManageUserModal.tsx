import type { AdminUserResponse } from '@hares/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { RoleBadge, StatusBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

type Mode = 'menu' | 'role' | 'department' | 'deactivate' | 'reactivate' | 'reopen' | 'grant' | 'revoke';

/**
 * Everything a System Admin can do to one account (WEB-FR-056..063), as a menu
 * of the actions that apply to the account's current status, each with its own
 * small form or confirmation. The API enforces the same rules (self-protection,
 * last admin, active department), the screen only offers what makes sense.
 */
export function ManageUserModal({ user, onClose }: { user: AdminUserResponse; onClose: () => void }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const qc = useQueryClient();
  const departments = useDepartments();
  const [mode, setMode] = useState<Mode>('menu');
  const [role, setRole] = useState<'USER' | 'DEPARTMENT_ADMIN'>(user.role === 'DEPARTMENT_ADMIN' ? 'DEPARTMENT_ADMIN' : 'USER');
  // Never preselected: the select only offers ACTIVE departments, and a hidden current id must not be sent.
  const [departmentId, setDepartmentId] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const active = (departments.data?.items ?? []).filter((d) => d.active);
  const isSelf = auth.user?.id === user.id;

  const m = useMutation({
    mutationFn: () => {
      const base = `/admin/users/${user.id}`;
      switch (mode) {
        case 'role':
          return api.patch(`${base}/role`, { role });
        case 'department':
          return api.patch(`${base}/department`, { department_id: departmentId });
        case 'deactivate':
          return api.post(`${base}/deactivate`);
        case 'reactivate':
          return api.post(`${base}/reactivate`, departmentId ? { department_id: departmentId } : {});
        case 'reopen':
          return api.post(`${base}/reopen`);
        case 'grant':
          return api.post(`${base}/grant-system-admin`);
        case 'revoke':
          return api.post(`${base}/revoke-system-admin`, { role, department_id: departmentId });
        default:
          throw new Error('no action');
      }
    },
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });

  const go = (next: Mode) => {
    m.reset();
    setDepartmentId('');
    setMode(next);
  };

  // Back to the menu: put the focus on its first action (the button that had it is gone).
  useEffect(() => {
    if (mode === 'menu') menuRef.current?.querySelector('button')?.focus();
  }, [mode]);

  const isSA = user.role === 'SYSTEM_ADMIN';
  const options: { mode: Mode; label: string; danger?: boolean }[] = [];
  if (user.status === 'ACTIVE') {
    if (!isSA) {
      options.push({ mode: 'role', label: t('manage.changeRole') }, { mode: 'department', label: t('manage.changeDepartment') });
      options.push({ mode: 'grant', label: t('manage.grantSystemAdmin') });
    } else if (!isSelf) {
      options.push({ mode: 'revoke', label: t('manage.revokeSystemAdmin') });
    }
    if (!isSelf) options.push({ mode: 'deactivate', label: t('users.deactivate'), danger: true });
  }
  if (user.status === 'DEACTIVATED') options.push({ mode: 'reactivate', label: t('manage.reactivate') });
  if (user.status === 'REJECTED') options.push({ mode: 'reopen', label: t('manage.reopen') });

  const roleSelect = (
    <SelectField label={t('users.role')} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
      <option value="USER">{t('roles.USER')}</option>
      <option value="DEPARTMENT_ADMIN">{t('roles.DEPARTMENT_ADMIN')}</option>
    </SelectField>
  );
  const departmentSelect = (required: boolean) => (
    <SelectField label={t('logs.department')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={departments.isLoading}>
      {!required && <option value="">{t('manage.keepDepartment')}</option>}
      {required && <option value="">{t('manage.chooseDepartment')}</option>}
      {active.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </SelectField>
  );

  const needsDepartment = mode === 'department' || mode === 'revoke';
  const canSubmit = !needsDepartment || Boolean(departmentId);
  const danger = mode === 'deactivate' || mode === 'grant' || mode === 'revoke';

  return (
    <Modal open onClose={onClose} title={user.full_name} description={user.email}>
      <div className="mb-4 flex flex-wrap gap-2">
        <RoleBadge role={user.role} />
        <StatusBadge status={user.status} />
        {user.department_name && <span className="h-pill role-user">{user.department_name}</span>}
      </div>

      {mode === 'menu' ? (
        options.length === 0 ? (
          <p className="m-0 text-[13.5px] text-ink-3">{t('manage.noActions')}</p>
        ) : (
          <div className="flex flex-col gap-2" ref={menuRef}>
            {options.map((o) => (
              <Button key={o.mode} variant={o.danger ? 'danger' : 'secondary'} className="justify-start" onClick={() => go(o.mode)}>
                {o.label}
              </Button>
            ))}
          </div>
        )
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) m.mutate();
          }}
        >
          <p className="m-0 text-[13.5px] text-ink-3">{t(`manage.explain.${mode}`)}</p>
          {(mode === 'role' || mode === 'revoke') && roleSelect}
          {mode === 'department' && departmentSelect(true)}
          {mode === 'revoke' && departmentSelect(true)}
          {mode === 'reactivate' && !isSA && (
            <>
              <p className="m-0 text-[13px] text-ink-3">{t('manage.currentDepartment', { name: user.department_name ?? '—' })}</p>
              {departmentSelect(false)}
            </>
          )}
          {m.isError && (
            <div className="err" role="alert">
              {apiErrorMessage(t, m.error)}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => go('menu')}>
              {t('app.back')}
            </Button>
            <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={m.isPending} loadingLabel={t('manage.working')} disabled={!canSubmit}>
              {t('manage.confirm')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
