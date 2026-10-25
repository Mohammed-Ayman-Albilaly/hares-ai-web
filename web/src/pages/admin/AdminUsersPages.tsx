import type { AdminUserResponse } from '@hares/contract';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { Button } from '@/components/ui/Button';
import { ManageUserModal } from '@/features/users/ManageUserModal';
import { PendingApprovals } from '@/features/users/PendingApprovals';
import { UsersView } from '@/features/users/UsersView';

/** Accounts waiting for approval (WEB-FR-056). */
export function AdminPendingPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('nav.adminPending')} crumb={t('navGroup.organization')}>
      <PendingApprovals />
    </Page>
  );
}

/** All users with every account action (role, department, activation, System Admin grant). */
export function AdminUsersPage() {
  const { t } = useTranslation();
  const [managing, setManaging] = useState<AdminUserResponse | null>(null);
  return (
    <Page title={t('nav.adminUsers')} crumb={t('navGroup.organization')}>
      <UsersView
        showDepartment
        renderActions={(u) => (
          <Button small variant="secondary" onClick={() => setManaging(u)} aria-label={t('manage.manageNamed', { name: u.full_name })}>
            {t('manage.manage')}
          </Button>
        )}
        emptyTitle={t('users.orgEmptyTitle')}
        emptyBody={t('users.orgEmptyBody')}
      />
      {/* Re-keyed by user so the form starts from that user's current values. */}
      {managing && <ManageUserModal key={managing.id} user={managing} onClose={() => setManaging(null)} />}
    </Page>
  );
}
