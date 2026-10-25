import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Logo, Wordmark } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { I } from '@/components/ui/icons';

/** Centered card on the grey page, with the wordmark and the language switcher (prototype AuthShell). */
export function AuthShell({ title, children, width = 420, icon }: { title: string; children: ReactNode; width?: number; icon?: ReactNode }) {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
  }, [title, t]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <header className="flex items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <Link to="/" className="no-underline" aria-label={t('app.name')}>
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to="/" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            <I.ChevronEnd size={14} className="rotate-180 rtl:rotate-0" /> {t('app.goHome')}
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="grid flex-1 place-items-center px-4 pb-16 pt-5 outline-none">
        <div className="card w-full p-7 sm:p-9" style={{ maxWidth: width }}>
          <div className="mb-[18px] grid place-items-center">
            {icon ?? <Logo size={42} />}
          </div>
          {children}
        </div>
      </main>
      <footer className="pb-7 text-center text-xs text-ink-4">© 2026 {t('app.name')} AI</footer>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h1 className="m-0 mb-1.5 text-center text-[22px] font-semibold">{title}</h1>
      {subtitle && <p className="m-0 mb-6 text-center text-[13.5px] text-ink-4">{subtitle}</p>}
    </>
  );
}

/** A form-level error or notice, announced to screen readers. */
export function FormAlert({ children, tone = 'error', quiet = false }: { children: ReactNode; tone?: 'error' | 'info'; quiet?: boolean }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      // `quiet`: text that changes every second (countdown) must not be re-read by screen readers.
      aria-live={quiet ? 'off' : undefined}
      className="mb-4 rounded-lg px-3.5 py-3 text-[13px]"
      style={{
        background: tone === 'error' ? 'var(--risk-high-soft)' : 'var(--accent-soft)',
        color: tone === 'error' ? 'var(--risk-high)' : 'var(--accent-2)',
      }}
    >
      {children}
    </div>
  );
}
