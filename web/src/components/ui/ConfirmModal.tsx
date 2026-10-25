import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from './Button';
import { I } from './icons';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  busyLabel: string;
  onConfirm: () => void;
  busy: boolean;
  error: unknown;
  /** Destructive actions are red and use the warning icon. */
  danger?: boolean;
  children?: ReactNode;
}

/** The "are you sure" dialog for actions that change someone's access or the organisation's setup. */
export function ConfirmModal({ open, onClose, title, description, confirmLabel, busyLabel, onConfirm, busy, error, danger = true, children }: Props) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} tone={danger ? 'danger' : 'default'} icon={<I.AlertTriangle size={20} />} title={title} description={description}>
      {children}
      {error ? (
        <div className="err mb-3" role="alert">
          {apiErrorMessage(t, error)}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('app.cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} loadingLabel={busyLabel}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
