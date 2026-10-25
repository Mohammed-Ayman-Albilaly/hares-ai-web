import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { I } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: number;
  /** Icon shown in a tinted square above the title (e.g. a warning for destructive confirmations). */
  icon?: ReactNode;
  tone?: 'default' | 'danger';
}

/**
 * Accessible dialog (Radix): focus is trapped and returned, Escape closes it,
 * the title and description are announced. Visual style follows the prototype.
 */
export function Modal({ open, onClose, title, description, children, width = 460, icon, tone = 'default' }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60]" style={{ background: 'rgb(8 14 28 / 0.55)', animation: 'fadeIn .14s ease' }} />
        <Dialog.Content
          className="card fixed start-1/2 top-1/2 z-[61] max-h-[calc(100dvh-64px)] overflow-auto"
          style={{
            width,
            maxWidth: 'calc(100vw - 32px)',
            transform: 'translate(-50%, -50%)',
            insetInlineStart: '50%',
            boxShadow: 'var(--shadow-lg)',
            animation: 'popIn .14s ease',
          }}
        >
          <div className="relative p-7">
            <Dialog.Close
              aria-label={t('app.close')}
              className="btn btn-ghost absolute end-3 top-3 !p-1.5"
            >
              <I.X size={16} />
            </Dialog.Close>
            {icon && (
              <div
                className="mb-3.5 grid size-11 place-items-center rounded-xl"
                style={{
                  background: tone === 'danger' ? 'var(--risk-high-soft)' : 'var(--accent-soft)',
                  color: tone === 'danger' ? 'var(--risk-high)' : 'var(--accent)',
                }}
              >
                {icon}
              </div>
            )}
            <Dialog.Title className="mb-1.5 text-lg font-semibold">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mb-4 text-[13.5px] leading-relaxed text-ink-3">{description}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
