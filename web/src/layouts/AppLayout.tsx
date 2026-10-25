import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { Sidebar } from '@/components/Sidebar';
import { ShellContext } from './shell-context';

/**
 * Authenticated shell (WEB-NFR-014 mobile-first): sidebar on wide screens, a
 * drawer on phones. Sidebar items depend on the role. The skip link lets
 * keyboard users jump past the navigation.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const openMenu = useCallback(() => setOpen(true), []);
  const shell = useMemo(() => ({ openMenu }), [openMenu]);

  if (auth.status !== 'authenticated') return null;

  return (
    <ShellContext.Provider value={shell}>
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <div className="app-shell">
        <Sidebar user={auth.user} />
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60]" style={{ background: 'rgb(8 14 28 / 0.55)', animation: 'fadeIn .14s ease' }} />
          <Dialog.Content
            className="fixed inset-y-0 start-0 z-[61] w-[280px] max-w-[85vw] outline-none"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">{t('app.menu')}</Dialog.Title>
            <Sidebar user={auth.user} className="!h-full w-full" onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ShellContext.Provider>
  );
}
