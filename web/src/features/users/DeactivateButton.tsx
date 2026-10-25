import type { AdminUserResponse } from '@hares/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { invalidateAdmin } from '@/features/common/invalidate';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

/**
 * Deactivate an account after an explicit confirmation (WEB-FR-061). The user
 * keeps their data, loses access at once (the API revokes their tokens).
 */
export function DeactivateButton({ user }: { user: AdminUserResponse }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post<AdminUserResponse>(`/admin/users/${user.id}/deactivate`),
    onSuccess: () => {
      setOpen(false);
      void invalidateAdmin(qc);
    },
  });

  return (
    <>
      <Button small variant="ghost" onClick={() => setOpen(true)} aria-label={t('users.deactivateNamed', { name: user.full_name })}>
        {t('users.deactivate')}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          m.reset();
        }}
        tone="danger"
        icon={<I.AlertTriangle size={20} />}
        title={t('users.deactivateTitle', { name: user.full_name })}
        description={t('users.deactivateBody')}
      >
        {m.isError && (
          <div className="err mb-3" role="alert">
            {apiErrorMessage(t, m.error)}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('app.cancel')}
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending} loadingLabel={t('users.deactivating')}>
            {t('users.deactivate')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
