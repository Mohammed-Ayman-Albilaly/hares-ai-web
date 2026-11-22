import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Logo, Wordmark } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Card } from '@/components/ui/layout';
import { I } from '@/components/ui/icons';

/**
 * Signed-out screen frame (prototype AuthShell): the public header on top, one
 * centred card for the task, the site footer at the foot. The card is the
 * shared `Card`, so its border, radius and padding come from the tokens.
 */
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
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <Link to="/" className="no-underline">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link to="/" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              <I.ChevronEnd size={14} className="rotate-180 rtl:rotate-0" /> {t('app.goHome')}
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="grid flex-1 place-items-center px-4 py-10 outline-none sm:py-14">
        <div className="w-full" style={{ maxWidth: width }}>
          <Card>
            <div className="mb-5 grid place-items-center">{icon ?? <Logo size={44} />}</div>
            {children}
          </Card>
        </div>
      </main>
      <footer className="border-t border-line bg-surface px-4 py-5 text-center text-xs text-ink-4">
        © {new Date().getFullYear()} {t('app.name')}. {t('landing.footer')}
      </footer>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h1 className="display m-0 mb-1.5 text-center text-[24px] leading-tight text-ink">{title}</h1>
      {subtitle && <p className="m-0 mb-6 text-center text-[13.5px] leading-relaxed text-ink-3">{subtitle}</p>}
    </>
  );
}

/** The 48px mark at the top of a state card (request sent, check your inbox). */
export function AuthMark({ tone = 'accent', children }: { tone?: 'accent' | 'neutral'; children: ReactNode }) {
  return (
    <span
      className="grid size-12 place-items-center rounded-xl"
      style={{
        background: tone === 'accent' ? 'var(--accent-soft)' : 'var(--surface-3)',
        color: tone === 'accent' ? 'var(--accent)' : 'var(--ink-3)',
      }}
    >
      {children}
    </span>
  );
}

/** A form-level error or notice, announced to screen readers. */
export function FormAlert({ children, tone = 'error', quiet = false }: { children: ReactNode; tone?: 'error' | 'info'; quiet?: boolean }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      // `quiet`: text that changes every second (countdown) must not be re-read by screen readers.
      aria-live={quiet ? 'off' : undefined}
      className="mb-4 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed"
      style={{
        background: tone === 'error' ? 'var(--risk-high-soft)' : 'var(--accent-soft)',
        color: tone === 'error' ? 'var(--risk-high)' : 'var(--accent-2)',
      }}
    >
      {children}
    </div>
  );
}
