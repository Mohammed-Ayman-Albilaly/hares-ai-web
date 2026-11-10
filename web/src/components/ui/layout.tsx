import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { IconComponent } from './icons';
import { formatNumber } from '@/components/charts/direction';
import { useLang } from '@/i18n/useLang';

/** A block of content on the page surface. `min-width` stays 0 so wide tables can scroll instead of stretching it. */
export function Card({ children, className = '', padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`card min-w-0 ${className}`} style={padded ? { padding: 'var(--card-p)' } : undefined}>
      {children}
    </div>
  );
}

/** A titled block of the page (heading + optional subtitle + actions). */
export function Section({
  title,
  sub,
  actions,
  children,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      {/* The title keeps its line: the actions wrap under it instead of squeezing it. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold text-ink">{title}</h2>
          {sub && <div className="mt-0.5 text-[12.5px] text-ink-4">{sub}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Heading of a card (title + subtitle on one side, a control on the other). */
export function CardHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h3 className="m-0 text-[15px] font-semibold">{title}</h3>
        {sub && <div className="mt-0.5 text-[12.5px] text-ink-4">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

/** Summary number (prototype "Stat"): label, big display number, optional icon. */
export function Stat({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  icon?: IconComponent;
  accent?: boolean;
  hint?: string;
}) {
  const lang = useLang();
  return (
    <dl className="card m-0 flex min-w-0 flex-col gap-2.5 px-5 py-[18px]">
      <dt className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 text-[12.5px] font-medium text-ink-3">{label}</span>
        {Icon && (
          <span
            className="grid size-7 shrink-0 place-items-center rounded-lg"
            style={{ background: accent ? 'var(--accent-soft)' : 'var(--surface-3)', color: accent ? 'var(--accent)' : 'var(--ink-3)' }}
          >
            <Icon size={15} />
          </span>
        )}
      </dt>
      {/* 30px on a phone keeps four figures inside two columns without shrinking the label. */}
      <dd className="num-display m-0 text-[30px] tabular-nums text-ink sm:text-4xl">
        {typeof value === 'number' ? formatNumber(value, lang) : value}
      </dd>
      {hint && <dd className="m-0 text-xs text-ink-4">{hint}</dd>}
    </dl>
  );
}

/** Bar of filters above a table: a named search landmark, one field per line on a phone. */
export function FilterBar({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="card filter-bar" role="search" aria-label={t('app.filters')}>
      {children}
    </div>
  );
}

/** Initials in the gradient avatar circle. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => [...s][0])
    .slice(0, 2)
    .join('');
  return (
    // The initials are drawn by CSS from data-initials: decoration, not page text.
    <div className="avatar" aria-hidden="true" data-initials={initials} style={{ width: size, height: size, fontSize: size * 0.4 }} />
  );
}

/**
 * The scroll box around a wide table. On a narrow screen the table scrolls
 * sideways, so the box needs a keyboard stop to be scrolled and a name to be
 * announced (axe: `scrollable-region-focusable`). `label` is the table's
 * caption text, so the region and the table carry the same name.
 *
 * The focus ring is the app's single `:focus-visible` rule in index.css (3px
 * `--accent` outline), the same one every control uses.
 */
export function TableScroller({
  label,
  busy,
  style,
  className = '',
  children,
}: {
  /** The table's caption text. */
  label: string;
  /** Dims the rows while the next page loads; also announced as busy. */
  busy?: boolean;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-x-auto ${className}`}
      style={style}
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
