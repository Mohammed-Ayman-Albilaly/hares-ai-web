import { useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Wordmark } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Card, Stat } from '@/components/ui/layout';
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
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-3 sm:px-8 lg:px-12">
          <Link to="/" className="no-underline">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-6 text-[13.5px] font-medium text-ink-2 md:flex" aria-label={t('app.mainNavigation')}>
            <a href="#features" className="inline-flex min-h-[44px] items-center text-inherit no-underline hover:text-accent">
              {t('landing.navFeatures')}
            </a>
            <a href="#how" className="inline-flex min-h-[44px] items-center text-inherit no-underline hover:text-accent">
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
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 pb-16 pt-12 sm:px-8 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
              <I.Shield size={13} /> {t('landing.badge')}
            </div>
            <h1 className="display m-0 mt-5 text-[38px] leading-[1.25] text-ink sm:text-[48px] lg:text-[56px]">
              {t('landing.titleA')} <span className="text-accent">{t('landing.titleEm')}</span> {t('landing.titleB')}
            </h1>
            <p className="m-0 mb-8 mt-4 max-w-[560px] text-[16.5px] leading-relaxed text-ink-3">{t('landing.body')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink to="/register" variant="primary" className="!px-[22px] !py-3 !text-[14.5px]">
                {t('landing.ctaStart')} <I.ArrowEnd size={15} className="rtl:rotate-180" />
              </ButtonLink>
              <ButtonLink to="/login" variant="secondary" className="!px-[18px] !py-3">
                {t('landing.ctaLogin')}
              </ButtonLink>
            </div>
          </div>

          {/* Illustrative dashboard preview */}
          <div className="relative" aria-hidden="true">
            <Card>
              <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="mono flex-1 truncate text-[11px] text-ink-4" dir="ltr">
                  {t('landing.previewUrl')}
                </span>
              </div>
              <div className="rounded-[var(--radius-md)] bg-surface-2 p-4">
                <div className="text-[11px] font-medium text-ink-4">{t('landing.previewToday')}</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="num-display text-[40px] text-ink">{formatNumber(1284, lang)}</span>
                  <span className="text-sm font-medium text-ink-2">{t('landing.previewScanned')}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Stat label={t('landing.previewBlocked')} value={17} />
                  <Stat label={t('landing.previewWarned')} value={42} />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {rows.map((r) => (
                    <div key={r.cls} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2">
                      <span className={`h-pill ${r.cls}`}>{r.label}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{r.text}</span>
                      <span className="shrink-0 text-[11px] text-ink-4">{t('landing.previewAgo')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <p className="m-0 mt-3 text-center text-[11.5px] text-ink-4">{t('landing.previewNote')}</p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-y border-line bg-surface-2 px-4 py-14 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-[1120px] flex-col" style={{ gap: 'var(--section-gap)' }}>
            <div>
              <p className="m-0 text-xs font-semibold text-accent">{t('landing.featuresEyebrow')}</p>
              <h2 className="display m-0 mt-2 text-[26px] leading-tight text-ink sm:text-[32px]">{t('landing.featuresTitle')}</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {features.map((f) => (
                <Card key={f.title} className="flex flex-col gap-3">
                  <span className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
                    <f.icon size={20} />
                  </span>
                  <h3 className="m-0 mt-1 text-[17px] font-semibold text-ink">{f.title}</h3>
                  <p className="m-0 text-sm leading-relaxed text-ink-3">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="px-4 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-[1120px] flex-col" style={{ gap: 'var(--section-gap)' }}>
            <div>
              <p className="m-0 text-xs font-semibold text-accent">{t('landing.howEyebrow')}</p>
              <h2 className="display m-0 mt-2 text-[26px] leading-tight text-ink sm:text-[32px]">{t('landing.howTitle')}</h2>
            </div>
            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              {steps.map((s, i) => (
                <li key={s.n} className="contents">
                  <Card className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="num-display text-[28px] text-accent">{s.n}</span>
                      <s.icon size={20} className="text-ink-4" />
                    </div>
                    <h3 className="m-0 text-[17px] font-semibold text-ink">{s.title}</h3>
                    <p className="m-0 text-[13.5px] leading-relaxed text-ink-3">{s.body}</p>
                  </Card>
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
        <section className="px-4 pb-20 pt-2 sm:px-8 lg:px-12">
          <Card className="mx-auto grid max-w-[1120px] items-center gap-6 bg-surface-2 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="display m-0 mb-2 text-[26px] leading-tight text-ink sm:text-[30px]">{t('landing.bandTitle')}</h2>
              <p className="m-0 text-[15px] leading-relaxed text-ink-3">{t('landing.bandBody')}</p>
            </div>
            <div className="flex flex-wrap gap-2.5 md:justify-end">
              <ButtonLink to="/register" variant="primary" className="!px-[22px] !py-[13px]">
                {t('landing.ctaStart')} <I.ArrowEnd size={15} className="rtl:rotate-180" />
              </ButtonLink>
              <ButtonLink to="/login" variant="secondary" className="!px-[22px] !py-[13px]">
                {t('landing.ctaLogin')}
              </ButtonLink>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-8 lg:px-12">
          <Wordmark sub={false} scale={0.85} />
          <p className="m-0 text-[12.5px] text-ink-4">
            © 2026 {t('app.name')} AI. {t('landing.footer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
