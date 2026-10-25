import { useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Wordmark } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { I } from '@/components/ui/icons';
import { formatNumber } from '@/components/charts/direction';
import { useLang } from '@/i18n/useLang';

/** Public landing page (prototype screen 1). The preview card is an illustration and says so. */
export function LandingPage() {
  const { t } = useTranslation();
  const lang = useLang();

  useEffect(() => {
    document.title = `${t('app.name')} AI · ${t('app.brandSub')}`;
  }, [t]);

  const features = [
    { icon: I.Bolt, title: t('landing.f1Title'), body: t('landing.f1Body') },
    { icon: I.Shield, title: t('landing.f2Title'), body: t('landing.f2Body') },
    { icon: I.Logs, title: t('landing.f3Title'), body: t('landing.f3Body') },
  ];
  const steps = [
    { n: '1', icon: I.Puzzle, title: t('landing.s1Title'), body: t('landing.s1Body') },
    { n: '2', icon: I.Sparkle, title: t('landing.s2Title'), body: t('landing.s2Body') },
    { n: '3', icon: I.Shield, title: t('landing.s3Title'), body: t('landing.s3Body') },
  ];
  const rows = [
    { cls: 'risk-high', label: t('risk.HIGH'), text: t('landing.previewRow1') },
    { cls: 'risk-med', label: t('risk.MEDIUM'), text: t('landing.previewRow2') },
    { cls: 'risk-low', label: t('risk.LOW'), text: t('landing.previewRow3') },
  ];

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-4 sm:px-8 lg:px-12">
        <Link to="/" className="no-underline">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-ink-2 md:flex" aria-label={t('app.mainNavigation')}>
          <a href="#features" className="text-inherit no-underline hover:text-accent">
            {t('landing.navFeatures')}
          </a>
          <a href="#how" className="text-inherit no-underline hover:text-accent">
            {t('landing.navHow')}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <ButtonLink to="/login" variant="ghost" className="hidden sm:inline-flex">
            {t('nav.login')}
          </ButtonLink>
          <ButtonLink to="/register" variant="primary">
            {t('nav.register')}
          </ButtonLink>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="mx-auto grid max-w-[1240px] items-center gap-14 px-4 pb-14 pt-14 sm:px-8 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--accent-2)' }}>
              <I.Shield size={13} /> {t('landing.badge')}
            </div>
            <h1 className="serif my-5 text-[44px] leading-[1.08] sm:text-[56px] lg:text-[64px]" style={{ letterSpacing: '-0.025em' }}>
              {t('landing.titleA')} <em className="not-italic text-accent" style={lang === 'en' ? { fontStyle: 'italic' } : undefined}>{t('landing.titleEm')}</em>{' '}
              {t('landing.titleB')}
            </h1>
            <p className="m-0 mb-7 max-w-[560px] text-[17px] leading-relaxed text-ink-3">{t('landing.body')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink to="/register" variant="primary" className="!px-[22px] !py-3 !text-[14.5px]">
                {t('landing.ctaStart')} <I.ArrowEnd size={15} className="rtl:rotate-180" />
              </ButtonLink>
              <ButtonLink to="/login" variant="ghost" className="!px-[18px] !py-3">
                {t('landing.ctaLogin')}
              </ButtonLink>
            </div>
          </div>

          {/* Illustrative dashboard preview */}
          <div className="relative" aria-hidden="true">
            <div className="card p-[18px]" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <div className="mb-3.5 flex items-center gap-2" dir="ltr">
                <span className="size-2.5 rounded-full" style={{ background: '#ff5f56' }} />
                <span className="size-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
                <span className="size-2.5 rounded-full" style={{ background: '#27c93f' }} />
                <div className="ms-2 flex-1 text-[11px] text-ink-4">{t('landing.previewUrl')}</div>
              </div>
              <div className="rounded-[10px] bg-bg p-4">
                <div className="text-[11px] text-ink-4">{t('landing.previewToday')}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="num-display text-[44px]">{formatNumber(1284, lang)}</span>
                  <span className="text-[15px] font-medium text-ink-2">{t('landing.previewScanned')}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="card p-3">
                    <div className="text-[11px] text-ink-4">{t('landing.previewBlocked')}</div>
                    <div className="num-display text-[28px]">17</div>
                  </div>
                  <div className="card p-3">
                    <div className="text-[11px] text-ink-4">{t('landing.previewWarned')}</div>
                    <div className="num-display text-[28px]">42</div>
                  </div>
                </div>
                <div className="mt-3.5 flex flex-col gap-2">
                  {rows.map((r) => (
                    <div key={r.cls} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px]">
                      <span className={`h-pill ${r.cls}`} style={{ padding: '2px 8px', fontSize: 10.5 }}>
                        {r.label}
                      </span>
                      <span className="flex-1 text-ink-2">{r.text}</span>
                      <span className="text-[11px] text-ink-4">{t('landing.previewAgo')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-[11.5px] text-ink-4">{t('landing.previewNote')}</div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-line bg-surface-2 px-4 py-14 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[1180px]">
            <div className="text-center text-xs font-medium text-ink-4">{t('landing.featuresEyebrow')}</div>
            <h2 className="serif mx-0 mb-10 mt-2.5 text-center text-[32px] sm:text-[40px]">{t('landing.featuresTitle')}</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="card p-7">
                  <div className="mb-[18px] grid size-10 place-items-center rounded-[10px] bg-accent-soft text-accent">
                    <f.icon size={20} />
                  </div>
                  <h3 className="m-0 mb-2 text-lg font-semibold">{f.title}</h3>
                  <p className="m-0 text-sm leading-relaxed text-ink-3">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="px-4 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[1180px]">
            <div className="text-center text-xs font-medium text-ink-4">{t('landing.howEyebrow')}</div>
            <h2 className="serif mx-0 mb-12 mt-2.5 text-center text-[32px] sm:text-[40px]">{t('landing.howTitle')}</h2>
            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              {steps.map((s, i) => (
                <li key={s.n} className="contents">
                  <div className="card flex flex-col gap-3 p-6">
                    <div className="flex items-center justify-between">
                      <span className="num-display text-[32px] text-accent">{s.n}</span>
                      <s.icon size={22} className="text-ink-3" />
                    </div>
                    <h3 className="m-0 text-[17px] font-semibold">{s.title}</h3>
                    <p className="m-0 text-[13.5px] leading-relaxed text-ink-3">{s.body}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden self-center text-ink-4 md:block" aria-hidden="true">
                      <I.ArrowEnd size={20} className="rtl:rotate-180" />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA band */}
        <section className="px-4 pb-24 pt-4 sm:px-8 lg:px-12">
          <div
            className="mx-auto grid max-w-[1180px] items-center gap-7 rounded-2xl p-8 text-white sm:p-14 md:grid-cols-[1.4fr_1fr]"
            style={{ background: 'var(--brand-navy)' }}
          >
            <div>
              <h2 className="serif m-0 mb-3 text-[32px] leading-tight sm:text-[38px]">{t('landing.bandTitle')}</h2>
              <p className="m-0 text-[15px] leading-relaxed" style={{ color: 'rgb(255 255 255 / 0.78)' }}>
                {t('landing.bandBody')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 md:justify-end">
              <ButtonLink to="/register" variant="primary" className="!px-[22px] !py-[13px]">
                {t('landing.ctaStart')} <I.ArrowEnd size={15} className="rtl:rotate-180" />
              </ButtonLink>
              <ButtonLink
                to="/login"
                className="!border-white/30 !bg-transparent !px-[22px] !py-[13px] !text-white hover:!bg-white/10"
              >
                {t('landing.ctaLogin')}
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-8 text-[12.5px] text-ink-4 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <Wordmark sub={false} scale={0.85} />
          <span>
            © 2026 {t('app.name')} AI. {t('landing.footer')}
          </span>
        </div>
      </footer>
    </div>
  );
}
