import { useTranslation } from 'react-i18next';

/** The shield mark from the prototype, on the brand navy square. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid shrink-0 place-items-center text-white"
      style={{ width: size, height: size, borderRadius: size * 0.29, background: 'var(--brand-navy)' }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
        <circle cx="12" cy="11" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 13.2v3.4M9.6 11h-2M16.4 11h-2M10.4 9 9 7.6M13.6 9l1.4-1.4" />
      </svg>
    </div>
  );
}

export function Wordmark({ scale = 1, sub = true }: { scale?: number; sub?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={28 * scale} />
      <div style={{ lineHeight: 1.1 }}>
        <div className="font-semibold text-ink" style={{ fontSize: 15 * scale }}>
          {t('app.name')} <span className="font-medium text-ink-3">AI</span>
        </div>
        {sub && (
          <div className="mt-px text-ink-4" style={{ fontSize: 10.5 * scale }}>
            {t('app.brandSub')}
          </div>
        )}
      </div>
    </div>
  );
}
