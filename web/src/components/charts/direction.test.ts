import { describe, expect, it } from 'vitest';
import { applyDirection, formatNumber } from './direction';

const base = {
  legend: { data: ['a', 'b', 'c'] },
  xAxis: { type: 'category', data: ['x', 'y'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', label: { show: true, position: 'right' }, data: [1, 2] }],
};

describe('applyDirection (charts follow the page direction)', () => {
  it('RTL: category axis runs right to left, value axis on the right, legend reversed, bar labels flipped', () => {
    const o = applyDirection(base, 'rtl') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(o.xAxis[0].inverse).toBe(true);
    expect(o.yAxis[0].position).toBe('right');
    expect(o.legend[0].data).toEqual(['c', 'b', 'a']);
    expect(o.series[0].label.position).toBe('left');
    expect(o.tooltip.extraCssText).toContain('direction:rtl');
    expect(o.textStyle.fontFamily).toContain('IBM Plex Sans Arabic');
  });

  it('LTR: nothing is mirrored', () => {
    const o = applyDirection(base, 'ltr') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(o.xAxis[0].inverse).toBe(false);
    expect(o.yAxis[0].position).toBe('left');
    expect(o.legend[0].data).toEqual(['a', 'b', 'c']);
    expect(o.series[0].label.position).toBe('right');
    expect(o.tooltip.extraCssText).toContain('direction:ltr');
  });

  it('does not mutate the input option and keeps formatter functions', () => {
    const fn = (v: number) => String(v);
    const input = { ...base, tooltip: { valueFormatter: fn } };
    const snapshot = JSON.stringify(base);
    const o = applyDirection(input, 'rtl') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(JSON.stringify(base)).toBe(snapshot);
    expect(o.tooltip.valueFormatter).toBe(fn);
  });
});

describe('formatNumber', () => {
  it('uses Western digits with grouping in both languages', () => {
    expect(formatNumber(1234567, 'ar')).toBe('1,234,567');
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
  });
});
