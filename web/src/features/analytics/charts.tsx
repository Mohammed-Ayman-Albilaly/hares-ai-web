import type { CategoryCode, DepartmentBreakdown, Platform, TimeseriesPoint } from '@hares/contract';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/components/charts/direction';
import { EChart } from '@/components/charts/EChart';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, TableScroller } from '@/components/ui/layout';
import { useDir, useLang } from '@/i18n/useLang';
import { useTheme } from '@/lib/theme';

/** Short day label (e.g. "25 Oct") for a UTC calendar day, Western digits. */
const dayLabel = (lang: 'ar' | 'en') => {
  const f = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (day: string) => f.format(new Date(`${day}T00:00:00Z`));
};

/** Every colour a chart may use. Risk colours mean a risk level and nothing else. */
export interface ChartColors {
  high: string;
  medium: string;
  low: string;
  none: string;
  /** Brand accent: counts and volumes that are not a risk level. */
  accent: string;
  ink: string;
  ink3: string;
  line: string;
  surface: string;
  /** Marks drawn over a filled shape (patterns for colour-blind readers). */
  decal: string;
}

/** Chart colours come from the CSS tokens, so charts follow the light/dark theme. */
export function useChartColors(): ChartColors {
  const theme = useTheme();
  return useMemo(() => {
    const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const g = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;
    return {
      high: g('--risk-high', '#b91c1c'),
      medium: g('--risk-med', '#92400e'),
      low: g('--risk-low', '#1d4ed8'),
      none: g('--risk-none', '#166534'),
      accent: g('--accent', '#006c35'),
      ink: g('--ink', '#0f172a'),
      ink3: g('--ink-3', '#475569'),
      line: g('--line', '#e1e6e1'),
      surface: g('--surface', '#ffffff'),
      // White marks read on the light theme's deep fills; black on the dark theme's pastels.
      decal: theme === 'dark' ? 'rgb(0 0 0 / 0.4)' : 'rgb(255 255 255 / 0.45)',
    };
  }, [theme]);
}

/**
 * What every chart shares: text and the tooltip box follow the tokens instead of
 * ECharts' dark defaults, so the chart reads as part of the page in both themes.
 * The font and the RTL mirroring are added by `applyDirection` in EChart.
 */
function frame(c: ChartColors) {
  return {
    textStyle: { color: c.ink3 },
    tooltip: {
      backgroundColor: c.surface,
      borderColor: c.line,
      borderWidth: 1,
      textStyle: { color: c.ink },
    },
  };
}

/** Legend under the plot: small markers, names in reading order (reversed for RTL by applyDirection). */
const legendAt = (c: ChartColors, names: string[]) => ({
  bottom: 0,
  data: names,
  itemWidth: 10,
  itemHeight: 10,
  itemGap: 16,
  textStyle: { color: c.ink3 },
});

/** Value axis: gridlines only, no axis line (the tokens carry the structure). */
const valueAxis = (c: ChartColors) => ({
  type: 'value',
  minInterval: 1,
  axisLabel: { color: c.ink3 },
  splitLine: { lineStyle: { color: c.line } },
  axisLine: { show: false },
  axisTick: { show: false },
});

/** Category axis: long names truncate instead of pushing the plot area. */
const categoryAxis = (c: ChartColors, data: string[], width = 150) => ({
  type: 'category',
  data,
  axisLabel: { color: c.ink3, width, overflow: 'truncate' },
  axisLine: { lineStyle: { color: c.line } },
  axisTick: { show: false },
});

/**
 * Four patterns, one per risk level, so the pie is readable without colour
 * (WCAG 1.4.1). `aria.label` stays off: the wrapper carries the name.
 */
const riskDecals = (color: string) => [
  { color, dashArrayX: [1, 0], dashArrayY: [2, 5], symbolSize: 1, rotation: Math.PI / 6 },
  { color, dashArrayX: [1, 0], dashArrayY: [4, 6], rotation: 0 },
  { color, dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: -Math.PI / 6 },
  { color, dashArrayX: [1, 0], dashArrayY: [3, 5], rotation: Math.PI / 2 },
];

interface TableColumn {
  header: string;
  numeric?: boolean;
}

/**
 * A chart card whose data is also available as a table (WCAG 1.1.1, decision
 * 58): the toggle swaps the picture for the same numbers.
 */
function ChartCard({
  title,
  sub,
  chart,
  columns,
  rows,
  action,
}: {
  title: string;
  sub?: string;
  chart: ReactNode;
  columns: TableColumn[];
  rows: (string | number)[][];
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const [asTable, setAsTable] = useState(false);
  const empty = rows.length === 0;
  return (
    <Card>
      <CardHeader
        title={title}
        sub={sub}
        action={
          <div className="flex items-center gap-2">
            {action}
            {/* An action button, not a toggle: its name says what a click does, so
                there is no second "pressed" state to contradict it. */}
            <Button small variant="ghost" disabled={empty} onClick={() => setAsTable((v) => !v)}>
              {asTable ? t('dash.showChart') : t('dash.showTable')}
            </Button>
          </div>
        }
      />
      {empty ? (
        <p className="m-0 py-8 text-center text-[13px] text-ink-4">{t('dash.noChartData')}</p>
      ) : asTable ? (
        // The table view of a chart scrolls both ways: sideways for wide rows, and down inside the chart's height.
        <TableScroller label={title} className="max-h-[260px] overflow-y-auto">
          <table className="h-table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} scope="col">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} style={columns[j]?.numeric ? { fontVariantNumeric: 'tabular-nums' } : undefined}>
                      {typeof cell === 'number' ? formatNumber(cell, lang) : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroller>
      ) : (
        chart
      )}
    </Card>
  );
}

const RISKS = ['HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;

/** Share of events per risk level. */
export function RiskDonut({ points, sub, action }: { points: TimeseriesPoint[]; sub?: string; action?: ReactNode }) {
  const { t } = useTranslation();
  const dir = useDir();
  const c = useChartColors();
  const f = frame(c);
  const sums = {
    HIGH: points.reduce((s, p) => s + p.high, 0),
    MEDIUM: points.reduce((s, p) => s + p.medium, 0),
    LOW: points.reduce((s, p) => s + p.low, 0),
    NONE: points.reduce((s, p) => s + p.none, 0),
  };
  const colors = { HIGH: c.high, MEDIUM: c.medium, LOW: c.low, NONE: c.none };
  const names = RISKS.map((r) => t(`risk.${r}`));
  const option = {
    ...f,
    color: RISKS.map((r) => colors[r]),
    tooltip: { ...f.tooltip, trigger: 'item' },
    legend: legendAt(c, names),
    aria: { enabled: true, label: { enabled: false }, decal: { show: true, decals: riskDecals(c.decal) } },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['50%', '44%'],
        label: { show: false },
        itemStyle: { borderColor: c.surface, borderWidth: 2 },
        data: RISKS.map((r, i) => ({ name: names[i], value: sums[r] })),
      },
    ],
  };
  return (
    <ChartCard
      title={t('dash.riskDistribution')}
      sub={sub}
      action={action}
      chart={<EChart option={option} direction={dir} label={t('dash.riskDistribution')} height={260} />}
      columns={[{ header: t('dash.riskLevel') }, { header: t('dash.count'), numeric: true }]}
      rows={RISKS.map((r, i) => [names[i]!, sums[r]])}
    />
  );
}

/** Daily events by risk level. */
export function RiskTrend({ points, sub }: { points: TimeseriesPoint[]; sub?: string }) {
  const { t } = useTranslation();
  const dir = useDir();
  const c = useChartColors();
  const f = frame(c);
  const names = [t('risk.HIGH'), t('risk.MEDIUM'), t('risk.LOW')];
  const label = dayLabel(useLang());
  const days = points.map((p) => label(p.day));
  const line = (name: string, color: string, data: number[], area = false) => ({
    name,
    type: 'line',
    smooth: false,
    showSymbol: false,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    ...(area ? { areaStyle: { color, opacity: 0.1 } } : {}),
    data,
  });
  const option = {
    ...f,
    tooltip: { ...f.tooltip, trigger: 'axis' },
    legend: legendAt(c, names),
    grid: { top: 16, right: 12, bottom: 56, left: 12, containLabel: true },
    xAxis: { ...categoryAxis(c, days), boundaryGap: false },
    yAxis: valueAxis(c),
    series: [
      line(names[0]!, c.high, points.map((p) => p.high), true),
      line(names[1]!, c.medium, points.map((p) => p.medium)),
      line(names[2]!, c.low, points.map((p) => p.low)),
    ],
  };
  return (
    <ChartCard
      title={t('dash.riskTrend')}
      sub={sub}
      chart={<EChart option={option} direction={dir} label={t('dash.riskTrend')} height={260} />}
      columns={[{ header: t('dash.day') }, ...names.map((n) => ({ header: n, numeric: true }))]}
      rows={points.map((p) => [p.day, p.high, p.medium, p.low])}
    />
  );
}

/** Horizontal bars (Arabic labels stay horizontal and readable, decision 58). */
function HBars({
  title,
  sub,
  items,
  firstColumn,
}: {
  title: string;
  sub?: string;
  items: { name: string; count: number }[];
  firstColumn: string;
}) {
  const { t } = useTranslation();
  const dir = useDir();
  const c = useChartColors();
  const f = frame(c);
  // ECharts draws the first category at the bottom: reverse so the largest is on top.
  const shown = [...items].reverse();
  const option = {
    ...f,
    tooltip: { ...f.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    // Symmetric: in RTL the value axis is mirrored and the count label moves to the other side.
    grid: { top: 8, right: 36, bottom: 8, left: 36, containLabel: true },
    xAxis: valueAxis(c),
    yAxis: categoryAxis(
      c,
      shown.map((i) => i.name),
    ),
    // One series, one meaning: counts take the brand accent, never a risk colour.
    series: [
      {
        type: 'bar',
        data: shown.map((i) => i.count),
        itemStyle: { color: c.accent, borderRadius: 3 },
        barMaxWidth: 18,
        label: { show: true, position: 'right', color: c.ink3 },
      },
    ],
  };
  return (
    <ChartCard
      title={title}
      sub={sub}
      chart={<EChart option={option} direction={dir} label={title} height={Math.max(180, items.length * 34 + 24)} />}
      columns={[{ header: firstColumn }, { header: t('dash.count'), numeric: true }]}
      rows={items.map((i) => [i.name, i.count])}
    />
  );
}

export function PlatformBars({ platforms }: { platforms: { platform: Platform; count: number }[] }) {
  const { t } = useTranslation();
  return (
    <HBars
      title={t('dash.platforms')}
      items={platforms.map((p) => ({ name: t(`platform.${p.platform}`), count: p.count }))}
      firstColumn={t('dash.platform')}
    />
  );
}

export function CategoryBars({ categories }: { categories: { category_code: CategoryCode; count: number }[] }) {
  const { t } = useTranslation();
  return (
    <HBars
      title={t('dash.topCategories')}
      sub={t('dash.topCategoriesSub')}
      items={categories.map((x) => ({ name: t(`category.${x.category_code}`), count: x.count }))}
      firstColumn={t('dash.category')}
    />
  );
}

/** Risk levels per department as stacked horizontal bars (organisation dashboard, WEB-FR-029). */
export function DepartmentRisk({ departments }: { departments: DepartmentBreakdown[] }) {
  const { t } = useTranslation();
  const dir = useDir();
  const c = useChartColors();
  const f = frame(c);
  const named = departments.map((d) => ({ ...d, label: d.department_name ?? t('dash.noDepartment') }));
  // The first department on top (ECharts draws the first category at the bottom).
  const shown = [...named].reverse();
  const levels = [
    { key: 'high', name: t('risk.HIGH'), color: c.high },
    { key: 'medium', name: t('risk.MEDIUM'), color: c.medium },
    { key: 'low', name: t('risk.LOW'), color: c.low },
    { key: 'none', name: t('risk.NONE'), color: c.none },
  ] as const;
  const option = {
    ...f,
    tooltip: { ...f.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: legendAt(
      c,
      levels.map((l) => l.name),
    ),
    grid: { top: 8, right: 24, bottom: 48, left: 24, containLabel: true },
    xAxis: valueAxis(c),
    yAxis: categoryAxis(
      c,
      shown.map((d) => d.label),
    ),
    series: levels.map((l) => ({
      name: l.name,
      type: 'bar',
      stack: 'risk',
      barMaxWidth: 22,
      itemStyle: { color: l.color },
      data: shown.map((d) => d[l.key]),
    })),
  };
  return (
    <ChartCard
      title={t('dash.byDepartment')}
      sub={t('dash.byDepartmentSub')}
      chart={<EChart option={option} direction={dir} label={t('dash.byDepartment')} height={Math.max(200, named.length * 38 + 80)} />}
      columns={[
        { header: t('logs.department') },
        { header: t('dash.totalEvents'), numeric: true },
        { header: t('risk.HIGH'), numeric: true },
        { header: t('risk.MEDIUM'), numeric: true },
        { header: t('risk.LOW'), numeric: true },
        { header: t('risk.NONE'), numeric: true },
        { header: t('dash.blocked'), numeric: true },
        { header: t('dash.warned'), numeric: true },
      ]}
      rows={named.map((d) => [d.label, d.total, d.high, d.medium, d.low, d.none, d.blocked, d.warned])}
    />
  );
}
