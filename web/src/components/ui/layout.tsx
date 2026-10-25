import type { ReactNode } from 'react';
import type { IconComponent } from './icons';
import { formatNumber } from '@/components/charts/direction';
import { useLang } from '@/i18n/useLang';

export function Card({ children, className = '', padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`card ${className}`} style={padded ? { padding: 'var(--card-p)' } : undefined}>
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
    <section className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-4">
        <div>
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
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
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
    <div className="card flex flex-col gap-2.5 px-5 py-[18px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-medium text-ink-3">{label}</div>
        {Icon && (
          <div
            className="grid size-7 place-items-center rounded-lg"
            style={{ background: accent ? 'var(--accent-soft)' : 'var(--surface-3)', color: accent ? 'var(--accent)' : 'var(--ink-3)' }}
          >
            <Icon size={15} />
          </div>
        )}
      </div>
      <div className="num-display text-4xl text-ink">{typeof value === 'number' ? formatNumber(value, lang) : value}</div>
      {hint && <div className="text-xs text-ink-4">{hint}</div>}
    </div>
  );
}

/** Bar of filters above a table. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="card flex flex-wrap items-center gap-2.5 p-3.5" role="search">
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
