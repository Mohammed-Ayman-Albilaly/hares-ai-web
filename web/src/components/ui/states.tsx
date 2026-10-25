import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorMessage } from '@/lib/errors';
import { Button } from './Button';
import { I } from './icons';

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Rows of skeleton lines for a table or list while data loads. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div className="card p-4" role="status" aria-live="polite">
      <span className="sr-only">{t('app.loading')}</span>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} style={{ height: 22, width: `${92 - (i % 3) * 9}%` }} />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-live="polite">
      <span className="sr-only">{t('app.loading')}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex flex-col gap-3 px-5 py-[18px]">
          <Skeleton style={{ height: 14, width: '60%' }} />
          <Skeleton style={{ height: 34, width: '45%' }} />
        </div>
      ))}
    </div>
  );
}

/** A failed load: what happened in plain words, and a retry (WEB-FR-027, WEB-FR-033). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <div className="grid size-11 place-items-center rounded-xl" style={{ background: 'var(--risk-high-soft)', color: 'var(--risk-high)' }}>
        <I.AlertTriangle size={20} />
      </div>
      <p className="m-0 max-w-md text-[13.5px] text-ink-2">{apiErrorMessage(t, error)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <I.Refresh size={14} /> {t('app.retry')}
        </Button>
      )}
    </div>
  );
}

/** Nothing to show yet (WEB-FR-027 "no results", WEB-FR-033 "no activity"). */
export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 grid size-11 place-items-center rounded-xl bg-surface-3 text-ink-3">{icon ?? <I.Logs size={20} />}</div>
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {body && <p className="m-0 max-w-md text-[13.5px] text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface DataStateProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  isEmpty?: boolean;
  skeleton: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}

/**
 * One place for the four states every data view has (loading skeleton, error
 * with retry, empty, populated), so no screen forgets one.
 */
export function DataState({ isLoading, isError, error, refetch, isEmpty, skeleton, empty, children }: DataStateProps) {
  if (isLoading) return <>{skeleton}</>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children}</>;
}
