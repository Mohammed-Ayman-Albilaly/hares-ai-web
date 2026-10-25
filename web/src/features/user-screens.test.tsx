import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, json, loginResponse, mockFetch, renderRoute, useArabic } from '@/test/utils';

// jsdom has no canvas, so ECharts cannot lay out text there; the real chart is checked in the browser and in
// direction.test.ts. Here the wrapper is a labelled placeholder, which is all the screens depend on.
vi.mock('@/components/charts/EChart', () => ({
  EChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

beforeEach(async () => {
  await useArabic();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const refresh = { 'POST /api/auth/refresh': () => json(loginResponse('USER')) };

const totals = { total_events: 53, intercepted: 37, blocked: 22, warned: 15, allowed: 16, high_risk: 20, high_risk_percent: 37.7, override_rate_percent: 16.2 };
const summary = {
  scope: 'OWN',
  from: '2026-09-26',
  to: '2026-10-25',
  total_users: 1,
  totals,
  platforms: [{ platform: 'CHATGPT', count: 32 }],
  top_categories: [{ category_code: 'PERSONAL_IDENTITY', count: 12 }],
  lag_seconds: 0,
};
const series = {
  scope: 'OWN',
  from: '2026-10-24',
  to: '2026-10-25',
  points: [
    { day: '2026-10-24', total: 3, high: 1, medium: 1, low: 0, none: 1, blocked: 1, warned: 1 },
    { day: '2026-10-25', total: 2, high: 0, medium: 1, low: 1, none: 0, blocked: 0, warned: 1 },
  ],
};
const item = (n: number, over: Record<string, unknown> = {}) => ({
  log_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  event_time: '2026-10-25T08:00:00.000Z',
  user_id: '11111111-1111-4111-8111-111111111111',
  user_name: 'Layla Test',
  department_id: null,
  department_name: null,
  platform: 'CHATGPT',
  risk_level: 'HIGH',
  action: 'BLOCKED',
  user_decision: 'CANCELLED',
  categories: ['PERSONAL_IDENTITY', 'CONTACT_INFO', 'FINANCIAL_BANKING'],
  ...over,
});

describe('user dashboard', () => {
  it('shows the figures, the charts and recent activity', async () => {
    mockFetch({
      ...refresh,
      'GET /api/dashboard/mine/summary': () => json(summary),
      'GET /api/dashboard/mine/timeseries': () => json(series),
      'GET /api/logs/mine': () => json({ items: [item(1)], next_cursor: null }),
    });
    renderRoute('/dashboard');
    expect(await screen.findByText('53')).toBeTruthy();
    expect(screen.getByText('16.2%')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'توزيع مستوى الخطر' })).toBeTruthy();
    expect(await screen.findByText('آخر النشاط')).toBeTruthy();
  });

  it('every chart can be shown as a table with the same numbers', async () => {
    mockFetch({
      ...refresh,
      'GET /api/dashboard/mine/summary': () => json(summary),
      'GET /api/dashboard/mine/timeseries': () => json(series),
      'GET /api/logs/mine': () => json({ items: [], next_cursor: null }),
    });
    renderRoute('/dashboard');
    await screen.findByText('53');
    const buttons = await screen.findAllByRole('button', { name: 'عرض كجدول' });
    expect(buttons).toHaveLength(4);
    await userEvent.click(buttons[0]!);
    const table = await screen.findByRole('table', { name: 'توزيع مستوى الخطر' });
    expect(within(table).getByText('مرتفع')).toBeTruthy();
  });

  it('empty range: tells the user why and what to do', async () => {
    mockFetch({
      ...refresh,
      'GET /api/dashboard/mine/summary': () => json({ ...summary, totals: { ...totals, total_events: 0 } }),
      'GET /api/dashboard/mine/timeseries': () => json({ ...series, points: [] }),
      'GET /api/logs/mine': () => json({ items: [], next_cursor: null }),
    });
    renderRoute('/dashboard');
    expect(await screen.findByText('لا يوجد نشاط في هذه الفترة')).toBeTruthy();
  });

  it('error: shows a message and retry loads it again', async () => {
    let fail = true;
    mockFetch({
      ...refresh,
      'GET /api/dashboard/mine/summary': () => (fail ? envelope(500, 'INTERNAL_ERROR') : json(summary)),
      'GET /api/dashboard/mine/timeseries': () => json(series),
      'GET /api/logs/mine': () => json({ items: [], next_cursor: null }),
    });
    renderRoute('/dashboard');
    const alert = await screen.findByRole('alert');
    expect(alert).toBeTruthy();
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'إعادة المحاولة' }));
    expect(await screen.findByText('53')).toBeTruthy();
  });

  it('changing the period asks for that range', async () => {
    const m = mockFetch({
      ...refresh,
      'GET /api/dashboard/mine/summary': () => json(summary),
      'GET /api/dashboard/mine/timeseries': () => json(series),
      'GET /api/logs/mine': () => json({ items: [], next_cursor: null }),
    });
    renderRoute('/dashboard');
    await screen.findByText('53');
    await userEvent.selectOptions(screen.getByLabelText('الفترة'), '7');
    await waitFor(() => {
      const urls = m.fn.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/summary'));
      const last = new URL(urls[urls.length - 1]!, 'http://x');
      const days = (Date.parse(last.searchParams.get('to')!) - Date.parse(last.searchParams.get('from')!)) / 86_400_000;
      expect(days).toBe(6);
    });
  });
});

describe('activity and blocked pages', () => {
  it('activity: filters go to the server and clear returns to the full list', async () => {
    const m = mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [item(1)], next_cursor: null }) });
    renderRoute('/activity');
    await screen.findByText('ChatGPT', { selector: 'td' });
    await userEvent.selectOptions(screen.getByLabelText('مستوى الخطر'), 'HIGH');
    await waitFor(() => expect(m.fn.mock.calls.some((c) => String(c[0]).includes('risk_level=HIGH'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: /مسح الفلاتر/ }));
    expect((screen.getByLabelText('مستوى الخطر') as HTMLSelectElement).value).toBe('');
  });

  it('a start date after the end date is refused before asking the server', async () => {
    const m = mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [item(1)], next_cursor: null }) });
    renderRoute('/activity');
    await screen.findByText('ChatGPT', { selector: 'td' });
    await userEvent.type(screen.getByLabelText('من تاريخ'), '2026-10-20');
    await userEvent.type(screen.getByLabelText('إلى تاريخ'), '2026-10-10');
    expect(await screen.findByText('تاريخ البداية يجب أن يسبق تاريخ النهاية.')).toBeTruthy();
    const sent = m.fn.mock.calls.map((c) => new URL(String(c[0]), 'http://x').searchParams).filter((p) => p.get('from') && p.get('to'));
    expect(sent.every((p) => p.get('from')! < p.get('to')!)).toBe(true);
  });

  it('paging: next uses the cursor, previous goes back to the first page', async () => {
    const m = mockFetch({
      ...refresh,
      'GET /api/logs/mine': ({ url }) =>
        url.includes('cursor=c2') ? json({ items: [item(2, { platform: 'GEMINI' })], next_cursor: null }) : json({ items: [item(1)], next_cursor: 'c2' }),
    });
    renderRoute('/activity');
    await screen.findByText('ChatGPT', { selector: 'td' });
    await userEvent.click(screen.getByRole('button', { name: 'التالي' }));
    expect(await screen.findByText('Gemini', { selector: 'td' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'التالي' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'السابق' }));
    expect(await screen.findByText('ChatGPT', { selector: 'td' })).toBeTruthy();
    const logCalls = m.fn.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/logs/mine'));
    expect(logCalls[logCalls.length - 1]).not.toContain('cursor=');
  });

  it('a filter change goes back to page 1, also when an earlier filter comes back', async () => {
    mockFetch({
      ...refresh,
      'GET /api/logs/mine': ({ url }) =>
        url.includes('cursor=c2') ? json({ items: [item(2, { platform: 'GEMINI' })], next_cursor: null }) : json({ items: [item(1)], next_cursor: 'c2' }),
    });
    renderRoute('/activity');
    await screen.findByText('ChatGPT', { selector: 'td' });
    await userEvent.click(screen.getByRole('button', { name: 'التالي' }));
    await screen.findByText('Gemini', { selector: 'td' });
    await userEvent.selectOptions(screen.getByLabelText('مستوى الخطر'), 'HIGH');
    await userEvent.selectOptions(screen.getByLabelText('مستوى الخطر'), '');
    expect(await screen.findByText('ChatGPT', { selector: 'td' })).toBeTruthy();
    expect(screen.getByText(/الصفحة ١|الصفحة 1/)).toBeTruthy();
  });

  it('date filters are sent as local midnight, the end date exclusive (next day)', async () => {
    const m = mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [item(1)], next_cursor: null }) });
    renderRoute('/activity');
    await screen.findByText('ChatGPT', { selector: 'td' });
    await userEvent.type(screen.getByLabelText('من تاريخ'), '2026-10-10');
    await userEvent.type(screen.getByLabelText('إلى تاريخ'), '2026-10-12');
    await waitFor(() => {
      const last = m.fn.mock.calls.map((c) => new URL(String(c[0]), 'http://x').searchParams).filter((p) => p.get('from') && p.get('to')).pop()!;
      expect(last.get('from')).toBe(new Date(2026, 9, 10).toISOString());
      expect(last.get('to')).toBe(new Date(2026, 9, 13).toISOString());
    });
  });

  it('a row opens to show all its data types, never message text', async () => {
    mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [item(1)], next_cursor: null }) });
    renderRoute('/activity');
    await userEvent.click(await screen.findByRole('button', { name: /عرض تفاصيل رسالة/ }));
    expect(await screen.findByText(/لا يحفظ حارس نص الرسائل أبداً/)).toBeTruthy();
    expect(screen.getAllByText('البيانات المالية والمصرفية').length).toBeGreaterThan(0);
  });

  it('no events at all: explains instead of showing an empty table', async () => {
    mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [], next_cursor: null }) });
    renderRoute('/activity');
    expect(await screen.findByText('لا يوجد نشاط بعد')).toBeTruthy();
  });

  it('blocked page always asks for action=BLOCKED and has no action filter', async () => {
    const m = mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [item(1)], next_cursor: null }) });
    renderRoute('/blocked');
    await screen.findByText('ChatGPT', { selector: 'td' });
    const logCalls = m.fn.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/logs/mine'));
    expect(logCalls.length).toBeGreaterThan(0);
    expect(logCalls.every((u) => u.includes('action=BLOCKED'))).toBe(true);
    expect(screen.queryByLabelText('الإجراء')).toBeNull();
  });

  it('is accessible (axe) with data on screen', async () => {
    mockFetch({ ...refresh, 'GET /api/logs/mine': () => json({ items: [item(1), item(2)], next_cursor: null }) });
    const { container } = renderRoute('/activity');
    await screen.findAllByText('ChatGPT', { selector: 'td' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('role access', () => {
  it('a department admin cannot open the user-only activity page', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => json(loginResponse('DEPARTMENT_ADMIN')) });
    renderRoute('/activity');
    expect(await screen.findByText('لا تملك صلاحية لهذه الصفحة')).toBeTruthy();
  });
});
