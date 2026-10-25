import { useEffect, useMemo, useState } from 'react';
import { EChart } from '@/components/charts/EChart';
import { formatNumber, type Direction } from '@/components/charts/direction';
import type { ChartOption } from '@/components/charts/echarts-setup';

// THROWAWAY (B9): proves Arabic/RTL rendering of ECharts (axes, legend, tooltip)
// and that every chart has a data-table equivalent. Deleted when B10 starts.

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const DEPARTMENTS = ['تقنية المعلومات', 'الموارد البشرية', 'المالية', 'الشؤون القانونية', 'المبيعات'];
const RISK = { high: 'مرتفع', medium: 'متوسط', low: 'منخفض', none: 'بدون خطر' } as const;
const COLORS = { high: '#c0261b', medium: '#b25e09', low: '#1a6aa6', none: '#6b7c74' };

const trend = { high: [12, 9, 15, 11, 18, 7, 3], medium: [24, 30, 22, 28, 35, 19, 8], low: [40, 44, 38, 52, 47, 31, 14], none: [120, 132, 118, 140, 151, 96, 40] };
const byDept = {
  high: [14, 6, 9, 5, 11],
  medium: [30, 18, 25, 12, 22],
  low: [41, 22, 33, 16, 29],
  none: [150, 88, 120, 61, 104],
};
const platforms = [
  { name: 'ChatGPT', value: 412 },
  { name: 'Gemini', value: 187 },
  { name: 'Claude', value: 154 },
];
const categories = [
  { name: 'معلومات الاتصال', value: 96 },
  { name: 'البيانات المالية والمصرفية', value: 71 },
  { name: 'بيانات الهوية الشخصية', value: 58 },
  { name: 'أسرار المصادقة', value: 33 },
  { name: 'البيانات الصحية', value: 21 },
];

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-[var(--color-primary)] underline">عرض البيانات كجدول</summary>
      <table className="mt-2 w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-[var(--color-border-strong)] p-2 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="border-b border-[var(--color-border)] p-2 text-start font-medium">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="border-b border-[var(--color-border)] p-2">
                    {typeof c === 'number' ? formatNumber(c) : c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function SpikePage() {
  const [dir, setDir] = useState<Direction>('rtl');
  const [renderer, setRenderer] = useState<'svg' | 'canvas'>('svg');

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en';
  }, [dir]);

  const trendOption = useMemo<ChartOption>(
    () => ({
      color: [COLORS.high, COLORS.medium, COLORS.low, COLORS.none],
      grid: { top: 48, bottom: 28, left: 56, right: 56, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatNumber(v) },
      legend: { top: 0, data: Object.values(RISK) },
      xAxis: { type: 'category', data: DAYS, boundaryGap: false },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumber(v) } },
      series: (Object.keys(RISK) as (keyof typeof RISK)[]).map((k) => ({ name: RISK[k], type: 'line', data: trend[k], smooth: true, symbolSize: 6 })),
    }),
    [],
  );

  // Department comparison = HORIZONTAL stacked bars: long Arabic names stay on one
  // line and read naturally on a phone (vertical category labels broke per letter).
  const stackedOption = useMemo<ChartOption>(
    () => ({
      color: [COLORS.high, COLORS.medium, COLORS.low, COLORS.none],
      grid: { top: 40, bottom: 8, left: 16, right: 16, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => formatNumber(v) },
      legend: { top: 0, data: Object.values(RISK) },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumber(v) } },
      yAxis: { type: 'category', data: DEPARTMENTS, inverse: true },
      series: (Object.keys(RISK) as (keyof typeof RISK)[]).map((k) => ({ name: RISK[k], type: 'bar', stack: 'risk', data: byDept[k], barMaxWidth: 26 })),
    }),
    [],
  );

  const horizontalOption = useMemo<ChartOption>(
    () => ({
      color: ['#0d6a40'],
      grid: { top: 8, bottom: 8, left: 16, right: 24, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => formatNumber(v) },
      xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatNumber(v) } },
      yAxis: { type: 'category', data: categories.map((c) => c.name), inverse: true },
      series: [{ type: 'bar', data: categories.map((c) => c.value), barMaxWidth: 22, label: { show: true, position: 'right', formatter: (p: { value: number }) => formatNumber(p.value) } }],
    }),
    [],
  );

  const pieOption = useMemo<ChartOption>(
    () => ({
      color: ['#0d6a40', '#1a6aa6', '#b25e09'],
      tooltip: { trigger: 'item', valueFormatter: (v: number) => formatNumber(v) },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'], data: platforms, label: { show: false }, emphasis: { label: { show: true, fontWeight: 600 } } }],
    }),
    [],
  );

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold">اختبار الرسوم البيانية العربية (B9)</h1>
      <p className="mt-1 text-[var(--color-text-muted)]">
        الاتجاه الحالي: <b>{dir}</b> · المحرك: <b>{renderer}</b>
      </p>
      <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Spike controls">
        <button className="rounded-lg border border-[var(--color-border-strong)] bg-white px-3 py-2" onClick={() => setDir(dir === 'rtl' ? 'ltr' : 'rtl')}>
          {dir === 'rtl' ? 'Switch to LTR' : 'التبديل إلى RTL'}
        </button>
        <button className="rounded-lg border border-[var(--color-border-strong)] bg-white px-3 py-2" onClick={() => setRenderer(renderer === 'svg' ? 'canvas' : 'svg')}>
          renderer: {renderer}
        </button>
      </div>

      <section className="mb-8 rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-2 text-lg font-semibold">اتجاه المخاطر خلال الأسبوع</h2>
        <EChart option={trendOption} direction={dir} renderer={renderer} label="اتجاه المخاطر خلال الأسبوع" />
        <Table caption="اتجاه المخاطر" head={['اليوم', ...Object.values(RISK)]} rows={DAYS.map((d, i) => [d, trend.high[i], trend.medium[i], trend.low[i], trend.none[i]])} />
      </section>

      <section className="mb-8 rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-2 text-lg font-semibold">توزيع المخاطر حسب الإدارة</h2>
        <EChart option={stackedOption} direction={dir} renderer={renderer} height={300} label="توزيع المخاطر حسب الإدارة" />
        <Table caption="المخاطر حسب الإدارة" head={['الإدارة', ...Object.values(RISK)]} rows={DEPARTMENTS.map((d, i) => [d, byDept.high[i], byDept.medium[i], byDept.low[i], byDept.none[i]])} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 text-lg font-semibold">أكثر فئات البيانات رصداً</h2>
          <EChart option={horizontalOption} direction={dir} renderer={renderer} height={260} label="أكثر فئات البيانات رصداً" />
          <Table caption="الفئات" head={['الفئة', 'العدد']} rows={categories.map((c) => [c.name, c.value])} />
        </section>
        <section className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-2 text-lg font-semibold">منصات الذكاء الاصطناعي</h2>
          <EChart option={pieOption} direction={dir} renderer={renderer} height={260} label="منصات الذكاء الاصطناعي" />
          <Table caption="المنصات" head={['المنصة', 'العدد']} rows={platforms.map((p) => [p.name, p.value])} />
        </section>
      </div>
    </main>
  );
}
