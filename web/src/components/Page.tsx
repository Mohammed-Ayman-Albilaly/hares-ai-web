import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { I } from '@/components/ui/icons';
import { useShell } from '@/layouts/shell-context';
import { UserMenu } from './UserMenu';

interface Props {
  title: string;
  /** Small line above the title (e.g. "Department · Engineering"). */
  crumb?: string;
  /** Buttons for this page, placed in the top bar. */
  actions?: ReactNode;
  children: ReactNode;
  /** Narrow, centred content (forms, profile). */
  narrow?: boolean;
}

/** Top bar + content of an authenticated screen (prototype `Topbar` + `.content`). */
export function Page({ title, crumb, actions, children, narrow }: Props) {
  const { t } = useTranslation();
  const auth = useAuth();
  const { openMenu } = useShell();

  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
  }, [title, t]);

  return (
    <>
      <header className="topbar">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="btn btn-ghost !p-2 min-[900px]:hidden" onClick={openMenu} aria-label={t('app.menu')}>
            <I.Menu size={18} />
          </button>
          <div className="min-w-0">
            {crumb && <div className="crumb truncate">{crumb}</div>}
            <h1 className="title m-0 truncate">{title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">{actions}</div>
          <LanguageSwitcher />
          <ThemeToggle />
          {auth.user && <UserMenu user={auth.user} />}
        </div>
      </header>
      <div id="main" tabIndex={-1} className="content flex flex-col outline-none" style={{ gap: 'var(--section-gap)', maxWidth: narrow ? 760 : undefined }}>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:hidden">{actions}</div>}
        {children}
      </div>
    </>
  );
}
