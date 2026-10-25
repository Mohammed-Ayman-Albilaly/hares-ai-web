import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, json, loginResponse, mockFetch, renderRoute, useArabic } from '@/test/utils';

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

const me = loginResponse('DEPARTMENT_ADMIN');
const refresh = { 'POST /api/auth/refresh': () => json(me) };

const user = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  full_name: `Staff ${n}`,
  email: `staff${n}@example.test`,
  status: 'ACTIVE',
  role: 'USER',
  department_id: me.user.department_id,
  department_name: 'Engineering',
  registered_at: '2026-10-01T08:00:00.000Z',
  approved_at: '2026-10-02T08:00:00.000Z',
  ...over,
});
const userList = (items: unknown[]) => ({ items, page: 1, page_size: 25, total: items.length });

const totals = { total_events: 10, intercepted: 6, blocked: 4, warned: 2, allowed: 4, high_risk: 3, high_risk_percent: 30, override_rate_percent: 10 };
const summary = { scope: 'DEPARTMENT', from: '2026-10-01', to: '2026-10-25', total_users: 4, totals, platforms: [], top_categories: [], lag_seconds: 0 };
const series = { scope: 'DEPARTMENT', from: '2026-10-25', to: '2026-10-25', points: [{ day: '2026-10-25', total: 10, high: 3, medium: 2, low: 1, none: 4, blocked: 4, warned: 2 }] };

describe('department dashboard', () => {
  it('a Department Admin sees the department dashboard with the highest-risk users', async () => {
    mockFetch({
      ...refresh,
      'GET /api/dashboard/department/summary': () => json(summary),
      'GET /api/dashboard/department/timeseries': () => json(series),
      'GET /api/dashboard/department/top-users': () =>
        json({ scope: 'DEPARTMENT', from: '2026-10-01', to: '2026-10-25', users: [{ user_id: user(1).id, user_name: 'Staff 1', total: 9, high: 5, blocked: 3, warned: 2 }] }),
    });
    renderRoute('/dashboard');
    expect(await screen.findByText('Staff 1')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'لوحة الإدارة' })).toBeTruthy();
  });

  it('no risky users: says so instead of showing an empty table', async () => {
    mockFetch({
      ...refresh,
      'GET /api/dashboard/department/summary': () => json(summary),
      'GET /api/dashboard/department/timeseries': () => json(series),
      'GET /api/dashboard/department/top-users': () => json({ scope: 'DEPARTMENT', from: '2026-10-01', to: '2026-10-25', users: [] }),
    });
    renderRoute('/dashboard');
    expect(await screen.findByText('لا يوجد مستخدمون برسائل عالية الخطر')).toBeTruthy();
  });
});

describe('department users', () => {
  it('can deactivate a user only after confirming; admins and the caller have no button', async () => {
    let list = [user(1), user(2, { role: 'DEPARTMENT_ADMIN', id: me.user.id, full_name: 'Me' }), user(3, { role: 'DEPARTMENT_ADMIN' })];
    const m = mockFetch({
      ...refresh,
      'GET /api/admin/users': () => json(userList(list)),
      'POST /api/admin/users/00000000-0000-4000-8000-000000000001/deactivate': () => {
        list = [user(1, { status: 'DEACTIVATED' }), ...list.slice(1)];
        return json(user(1, { status: 'DEACTIVATED' }));
      },
    });
    renderRoute('/department/users');
    await screen.findByText('Staff 1');
    // one button: Staff 1 (a user). Not the caller, not the other admin.
    const buttons = screen.getAllByRole('button', { name: /^تعطيل حساب/ });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(m.count('POST /api/admin/users/00000000-0000-4000-8000-000000000001/deactivate')).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'تعطيل' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(m.count('POST /api/admin/users/00000000-0000-4000-8000-000000000001/deactivate')).toBe(1);
    expect(await screen.findByText('معطّل', { selector: '.h-pill' })).toBeTruthy();
  });

  it('a server refusal is shown in the dialog and nothing changes', async () => {
    mockFetch({
      ...refresh,
      'GET /api/admin/users': () => json(userList([user(1)])),
      'POST /api/admin/users/00000000-0000-4000-8000-000000000001/deactivate': () => envelope(403, 'FORBIDDEN'),
    });
    renderRoute('/department/users');
    await userEvent.click(await screen.findByRole('button', { name: /^تعطيل حساب/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'تعطيل' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('search waits for a pause and is sent to the server', async () => {
    const m = mockFetch({ ...refresh, 'GET /api/admin/users': () => json(userList([user(1)])) });
    renderRoute('/department/users');
    await screen.findByText('Staff 1');
    await userEvent.type(screen.getByLabelText('بحث'), 'ali');
    await waitFor(() => expect(m.fn.mock.calls.some((c) => String(c[0]).includes('q=ali'))).toBe(true));
    // not one request per keystroke
    expect(m.fn.mock.calls.filter((c) => String(c[0]).includes('q=')).length).toBe(1);
  });

  it('is accessible (axe)', async () => {
    mockFetch({ ...refresh, 'GET /api/admin/users': () => json(userList([user(1), user(3, { role: 'DEPARTMENT_ADMIN' })])) });
    const { container } = renderRoute('/department/users');
    await screen.findByText('Staff 1');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('department policy and rules are read-only', () => {
  it('policy shows the effective action per category with no edit controls', async () => {
    mockFetch({
      ...refresh,
      [`GET /api/admin/policy/departments/${me.user.department_id}`]: () =>
        json({
          version: 3,
          department_id: me.user.department_id,
          items: [{ category_code: 'CONTACT_INFO', name: 'Contact Information', default_risk_level: 'MEDIUM', action: 'WARN', enabled: true, source: 'DEFAULT' }],
        }),
    });
    renderRoute('/department/policy');
    const cell = await screen.findByText('معلومات الاتصال', { selector: 'td' });
    const row = cell.closest('tr')!;
    expect(within(row).getByText('تنبيه')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('للعرض فقط');
    expect(screen.queryByRole('button', { name: /حفظ|تعديل|إضافة/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('rules: pattern and keyword text is shown, the TOPIC description never is', async () => {
    const rule = (id: string, kind: string, definition: string) => ({ id, name: `Rule ${kind}`, kind, definition, risk_level: 'HIGH', action: 'BLOCK', scope: 'ORG_WIDE', department_ids: [], enabled: true });
    mockFetch({
      ...refresh,
      'GET /api/admin/rules': () =>
        json({
          version: 1,
          items: [
            rule('00000000-0000-4000-8000-0000000000a1', 'PATTERN', 'EMP-\\d{6}'),
            rule('00000000-0000-4000-8000-0000000000a2', 'TOPIC', 'secret project atlas details'),
          ],
        }),
    });
    renderRoute('/department/rules');
    expect(await screen.findByText('EMP-\\d{6}')).toBeTruthy();
    expect(screen.queryByText(/atlas/)).toBeNull();
    expect(screen.getByText('مخفي (وصف سري)')).toBeTruthy();
  });
});

describe('department logs', () => {
  it('has the user filter and the CSV export, and shows the user column', async () => {
    mockFetch({
      ...refresh,
      'GET /api/admin/users': () => json(userList([user(1)])),
      'GET /api/admin/logs': () =>
        json({
          items: [
            {
              log_id: '00000000-0000-4000-8000-0000000000b1',
              event_time: '2026-10-25T08:00:00.000Z',
              user_id: user(1).id,
              user_name: 'Staff 1',
              department_id: me.user.department_id,
              department_name: 'Engineering',
              platform: 'CHATGPT',
              risk_level: 'HIGH',
              action: 'BLOCKED',
              user_decision: 'CANCELLED',
              categories: ['CONTACT_INFO'],
            },
          ],
          next_cursor: null,
        }),
    });
    renderRoute('/department/logs');
    expect(await screen.findByText('Staff 1', { selector: 'td' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /تصدير CSV/ })).toBeTruthy();
    expect(screen.getByLabelText('المستخدم')).toBeTruthy();
  });

  it('a chosen user can be cleared again, and no match says "no results" rather than "no events yet"', async () => {
    const m = mockFetch({
      ...refresh,
      'GET /api/admin/users': () => json(userList([user(1)])),
      'GET /api/admin/logs': ({ url }) => json({ items: [], next_cursor: null, ...(url.includes('user_id=') ? {} : {}) }),
    });
    renderRoute('/department/logs');
    await screen.findByText('لا يوجد نشاط في الإدارة بعد');
    await userEvent.selectOptions(await screen.findByLabelText('المستخدم'), user(1).id);
    expect(await screen.findByText('لا توجد نتائج مطابقة')).toBeTruthy();
    expect(m.fn.mock.calls.some((c) => String(c[0]).includes(`user_id=${user(1).id}`))).toBe(true);
    await userEvent.click(screen.getAllByRole('button', { name: /مسح الفلاتر/ })[0]!);
    expect((screen.getByLabelText('المستخدم') as HTMLSelectElement).value).toBe('');
    expect(await screen.findByText('لا يوجد نشاط في الإدارة بعد')).toBeTruthy();
  });

  it('export failure is shown next to the button', async () => {
    mockFetch({
      ...refresh,
      'GET /api/admin/users': () => json(userList([])),
      'GET /api/admin/logs': () => json({ items: [], next_cursor: null }),
      'GET /api/admin/logs/export': () => envelope(500, 'INTERNAL_ERROR'),
    });
    renderRoute('/department/logs');
    await userEvent.click(await screen.findByRole('button', { name: /تصدير CSV/ }));
    expect(await screen.findByText(/تعذّر التصدير/)).toBeTruthy();
  });

  it('export saves the file the server names', async () => {
    const created: string[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => (created.push('blob'), 'blob:x'), revokeObjectURL: () => undefined }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mockFetch({
      ...refresh,
      'GET /api/admin/users': () => json(userList([])),
      'GET /api/admin/logs': () => json({ items: [], next_cursor: null }),
      'GET /api/admin/logs/export': () =>
        new Response('log_id\n', { status: 200, headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="activity-logs-20261025.csv"' } }),
    });
    renderRoute('/department/logs');
    await userEvent.click(await screen.findByRole('button', { name: /تصدير CSV/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(created).toHaveLength(1);
    click.mockRestore();
  });
});

describe('role access', () => {
  it('a plain user cannot open department pages', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => json(loginResponse('USER')) });
    renderRoute('/department/users');
    expect(await screen.findByText('لا تملك صلاحية لهذه الصفحة')).toBeTruthy();
  });
});
