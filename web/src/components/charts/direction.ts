import type { ChartOption } from './echarts-setup';

export type Direction = 'rtl' | 'ltr';

const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, system-ui, sans-serif";

type Loose = Record<string, unknown>;
const asArray = (v: unknown): Loose[] => (Array.isArray(v) ? (v as Loose[]) : v ? [v as Loose] : []);

/**
 * Make a chart option follow the page direction (WEB-NFR-012, B9 spike).
 *
 * ECharts has no `rtl` switch, so the mirroring is done here, once, for every
 * chart in the app:
 *  - the category (x) axis runs right to left, so the first category is on the
 *    right, like the reading order;
 *  - the value (y) axis sits on the right;
 *  - legend items and the tooltip box are aligned and directed with the page;
 *  - every text uses the app font so Arabic shapes and numerals match the UI.
 * Pie charts need nothing more than the text and legend settings.
 */
export function applyDirection(option: ChartOption, dir: Direction): ChartOption {
  const rtl = dir === 'rtl';
  // Shallow copy: options contain formatter functions, which structuredClone cannot copy.
  const o = { ...(option as Loose) };

  o.textStyle = { fontFamily: FONT, ...(o.textStyle as Loose | undefined) };

  if (o.xAxis) o.xAxis = asArray(o.xAxis).map((a) => ({ ...a, inverse: rtl }));
  if (o.yAxis) o.yAxis = asArray(o.yAxis).map((a) => ({ ...a, position: rtl ? 'right' : 'left' }));

  if (o.legend) {
    o.legend = asArray(o.legend).map((l) => ({
      ...l,
      left: 'center',
      // First item on the right in RTL. Charts must pass `legend.data` explicitly.
      ...(rtl && Array.isArray(l.data) ? { data: [...(l.data as unknown[])].reverse() } : {}),
      textStyle: { fontFamily: FONT, ...(l.textStyle as Loose | undefined) },
    }));
  }

  // Bar end labels follow the mirrored value axis ("right" of a bar becomes "left").
  if (rtl && o.series) {
    const flip = (p: unknown) => (p === 'right' ? 'left' : p === 'left' ? 'right' : p);
    o.series = asArray(o.series).map((sr) => {
      const label = sr.label as Loose | undefined;
      return label && 'position' in label ? { ...sr, label: { ...label, position: flip(label.position) } } : sr;
    });
  }

  o.tooltip = {
    confine: true,
    ...(o.tooltip as Loose | undefined),
    textStyle: { fontFamily: FONT, ...((o.tooltip as Loose | undefined)?.textStyle as Loose | undefined) },
    extraCssText: `direction:${dir};text-align:${rtl ? 'right' : 'left'};`,
  };
  return o as ChartOption;
}

/** Western digits with grouping in both languages (decision: unambiguous numbers). */
export const formatNumber = (n: number, locale: 'ar' | 'en' = 'ar'): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US').format(n);
