import { useEffect, useMemo, useRef, useState } from 'react';
import { applyDirection, type Direction } from './direction';
import { echarts, type ChartOption } from './echarts-setup';

interface Props {
  option: ChartOption;
  direction: Direction;
  /** Accessible name; the same data must also be available as a table next to the chart. */
  label: string;
  height?: number;
  renderer?: 'svg' | 'canvas';
}

/**
 * Thin ECharts wrapper: creates the chart once per renderer, re-applies the
 * option (mirrored for the page direction) when it changes, and keeps the size
 * in step with its container. The SVG renderer is the default: text is real DOM
 * text (crisp in print, correct Arabic shaping, inspectable by tests and
 * assistive tools). The container is always `dir="ltr"`: SVG text anchors flip
 * in an RTL container (legend labels would run over their markers); the mirroring
 * is done in the option instead (see applyDirection) and Arabic text still shapes
 * and orders correctly inside each label. The chart is `role="img"`; its data is always offered as a
 * table by the caller (WCAG 1.1.1).
 */
export function EChart({ option, direction, label, height = 320, renderer = 'svg' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const mirrored = useMemo(() => applyDirection(option, direction), [option, direction]);
  const fontsReady = useFontsReady();

  useEffect(() => {
    // ECharts measures text once to lay out legends and labels: do it only after
    // the web font is loaded, or Arabic labels overlap their legend markers.
    if (!ref.current || !fontsReady) return;
    const chart = echarts.init(ref.current, undefined, { renderer });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [renderer, fontsReady]);

  useEffect(() => {
    chartRef.current?.setOption(mirrored, { notMerge: true });
  }, [mirrored, renderer, fontsReady]);

  return <div ref={ref} role="img" aria-label={label} style={{ width: '100%', height }} dir="ltr" />;
}

/** True once the app font is loaded (or fonts are unsupported, e.g. in tests). */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || !document.fonts);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    Promise.all([
      document.fonts.load("400 14px 'IBM Plex Sans Arabic'", 'مرحبا'),
      document.fonts.load("600 14px 'IBM Plex Sans Arabic'", 'مرحبا'),
    ])
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}
