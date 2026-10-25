import type { DashboardSummaryResponse } from '@hares/contract';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { I } from '@/components/ui/icons';
import { SelectField } from '@/components/ui/SelectField';
import { Stat } from '@/components/ui/layout';
import { DataState, EmptyState, StatsSkeleton, Skeleton } from '@/components/ui/states';
import { Card } from '@/components/ui/layout';
import { CategoryBars, PlatformBars, RiskDonut, RiskTrend } from './charts';
import { useDashboard } from './hooks';
import { RANGE_OPTIONS } from './range';

interface Props {
  /** `/dashboard/mine`, `/dashboard/department` or `/dashboard/org`. */
  base: string;
  extra?: Record<string, string>;
  /** Shown after the charts (recent activity, breakdown tables…). */
  children?: ReactNode | ((days: number, summary: DashboardSummaryResponse | undefined) => ReactNode);
  /** Text when the range has no events at all. */
  emptyTitle: string;
  emptyBody: string;
}

function ChartsSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-live="polite">
      <span className="sr-only">{t('app.loading')}</span>
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton style={{ height: 18, width: '40%', marginBottom: 18 }} />
          <Skeleton style={{ height: 220 }} />
        </Card>
      ))}
    </div>
  );
}

/**
 * Stats and charts of one dashboard scope, with a date-range choice. Shared by
 * the personal, department and organisation dashboards: only the endpoint
 * differs. Every chart can be shown as a table.
 */
export function DashboardView({ base, extra, children, emptyTitle, emptyBody }: Props) {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const { summary, series } = useDashboard(base, days, extra);

  const rangeSelect = (
    <SelectField label={t('dash.range')} value={days} onChange={(e) => setDays(Number(e.target.value))}>
      {RANGE_OPTIONS.map((d) => (
        <option key={d} value={d}>
          {t(`dash.days${d}`)}
        </option>
      ))}
    </SelectField>
  );

  const s = summary.data;
  const rangeSub = t(`dash.days${days}`);

  return (
    <div className="flex flex-col gap-[var(--section-gap)]" aria-busy={summary.isPlaceholderData || undefined} style={{ opacity: summary.isPlaceholderData ? 0.6 : 1 }}>
      <div className="flex justify-end">{rangeSelect}</div>

      <DataState
        isLoading={summary.isLoading}
        isError={summary.isError}
        error={summary.error}
        refetch={() => void summary.refetch()}
        isEmpty={s?.totals.total_events === 0}
        skeleton={
          <>
            <StatsSkeleton />
            <ChartsSkeleton />
          </>
        }
        empty={<EmptyState title={emptyTitle} body={emptyBody} icon={<I.Activity size={20} />} />}
      >
        {s && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label={t('dash.totalEvents')} value={s.totals.total_events} icon={I.Activity} />
              <Stat label={t('dash.blocked')} value={s.totals.blocked} icon={I.Block} accent />
              <Stat label={t('dash.warned')} value={s.totals.warned} icon={I.AlertTriangle} />
              <Stat
                label={t('dash.overrideRate')}
                value={`${s.totals.override_rate_percent}%`}
                icon={I.Edit}
                hint={t('dash.overrideHint')}
              />
            </div>

            <DataState
              isLoading={series.isLoading}
              isError={series.isError}
              error={series.error}
              refetch={() => void series.refetch()}
              skeleton={<ChartsSkeleton />}
            >
              {series.data && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <RiskDonut points={series.data.points} sub={rangeSub} />
                  <RiskTrend points={series.data.points} sub={t('dash.dailyEvents')} />
                </div>
              )}
            </DataState>

            <div className="grid gap-4 lg:grid-cols-2">
              <PlatformBars platforms={s.platforms} />
              <CategoryBars categories={s.top_categories} />
            </div>
          </>
        )}
      </DataState>
      {typeof children === 'function' ? children(days, s) : children}
    </div>
  );
}
