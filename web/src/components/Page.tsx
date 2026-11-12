import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor, sectionHomeFor, type NavGroup } from '@/auth/routes';
import { IconButton } from '@/components/ui/IconButton';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { I } from '@/components/ui/icons';
import { useShell } from '@/layouts/shell-context';
import { UserMenu } from './UserMenu';

interface Props {
  title: string;
  /** Sidebar section of the page: the breadcrumb links to the section's first screen. */
  group?: NavGroup;
  /** Buttons for this page, in their own row above the content. */
  actions?: ReactNode;
  children: ReactNode;
  /** Narrow, centred content (forms, profile). */
  narrow?: boolean;
}

/**
 * Top bar + content of an authenticated screen (prototype `Topbar` + `.content`).
 * The breadcrumb is real navigation (WCAG 2.4.8): it lists the screens above this
 * one as links, so the trail never links to the screen already open. The page name
 * is the `h1` beside it, so it is written once.
 */
export function Page({ title, group, actions, children, narrow }: Props) {
  const { t } = useTranslation();
  const auth = useAuth();
  const { openMenu } = useShell();
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
  }, [title, t]);

  const role = auth.user?.role ?? null;
  const section = group ? sectionHomeFor(group, role) : undefined;
  const home = homeFor(role);
  const steps = [
    // Home is a separate step only when the section is not already the role's landing screen.
    ...(section && section !== home ? [{ label: t('app.home'), to: home }] : []),
    ...(section ? [{ label: t(`navGroup.${group}`), to: section }] : []),
  ];
  // Only the steps above this screen: a link back to the same page is a dead end.
  const trail = steps.filter((step) => step.to !== pathname);

  return (
    <>
      <header className="topbar">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconButton
            label={t('app.menu')}
            className="min-[900px]:hidden"
            onClick={(e) => openMenu(e.currentTarget)}
          >
            <I.Menu size={18} />
          </IconButton>
          {/* Phones have no sidebar, so the mark keeps the brand in view; it is decoration only. */}
          <span className="min-[900px]:hidden">
            <Logo size={26} />
          </span>
          <div className="min-w-0">
            {trail.length > 0 && (
              <nav aria-label={t('app.breadcrumb')} className="crumb">
                <ol className="crumb-list">
                  {trail.map((step, i) => (
                    <li key={step.to} className="crumb-item">
                      {i > 0 && (
                        <span className="crumb-sep" aria-hidden="true">
                          /
                        </span>
                      )}
                      <Link to={step.to} className="crumb-link truncate">
                        {step.label}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <h1 className="title m-0 truncate">{title}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher />
          <ThemeToggle />
          {auth.user && <UserMenu user={auth.user} />}
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="content flex flex-col outline-none"
        style={{ gap: 'var(--section-gap)', maxWidth: narrow ? 760 : undefined }}
      >
        {actions && <div className="page-actions">{actions}</div>}
        {children}
      </main>
    </>
  );
}
