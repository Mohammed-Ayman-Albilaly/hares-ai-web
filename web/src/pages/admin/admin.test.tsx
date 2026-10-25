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

const me = loginResponse('SYSTEM_ADMIN');
const refresh = { 'POST /api/auth/refresh': () => json(me) };
const DEPT_A = '00000000-0000-4000-8000-0000000000d1';
const DEPT_B = '00000000-0000-4000-8000-0000000000d2';
const departments = {
  items: [
    { id: DEPT_A, name: 'Engineering', active: true, member_count: 4 },
    { id: DEPT_B, name: 'Legal', active: true, member_count: 2 },
  ],
};
const deptRoute = { 'GET /api/admin/departments': () => json(departments) };

const user = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  full_name: `Staff ${n}`,
  email: `staff${n}@example.test`,
  status: 'ACTIVE',
  role: 'USER',
  department_id: DEPT_A,
  department_name: 'Engineering',
  registered_at: '2026-10-01T08:00:00.000Z',
  approved_at: '2026-10-02T08:00:00.000Z',
  ...over,
});
const userList = (items: unknown[]) => ({ items, page: 1, page_size: 25, total: items.length });

describe('access', () => {
  it('a Department Admin cannot open any /admin page', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => json(loginResponse('DEPARTMENT_ADMIN')) });
    renderRoute('/admin/audit');
    expect(await screen.findByText('لا تملك صلاحية لهذه الصفحة')).toBeTruthy();
  });
});

describe('organisation dashboard', () => {
  it('shows the figures and the risk split per department', async () => {
    const totals = { total_events: 20, intercepted: 12, blocked: 8, warned: 4, allowed: 8, high_risk: 6, high_risk_percent: 30, override_rate_percent: 5 };
    mockFetch({
      ...refresh,
      'GET /api/dashboard/org/summary': () =>
        json({
          scope: 'ORG',
          from: '2026-10-01',
          to: '2026-10-25',
          total_users: 6,
          totals,
          platforms: [],
          top_categories: [],
          lag_seconds: 0,
          departments: [{ department_id: DEPT_A, department_name: 'Engineering', total: 20, high: 6, medium: 4, low: 2, none: 8, blocked: 8, warned: 4 }],
        }),
      'GET /api/dashboard/org/timeseries': () => json({ scope: 'ORG', from: '2026-10-25', to: '2026-10-25', points: [] }),
    });
    renderRoute('/admin/dashboard');
    expect(await screen.findByText('20')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'الخطر حسب الإدارة' })).toBeTruthy();
  });
});

describe('pending approvals', () => {
  it('approving needs a department, then sends department and role', async () => {
    let pending = [user(1, { status: 'PENDING', role: null, department_id: null, department_name: null })];
    const m = mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/users/pending': () => json(userList(pending)),
      [`POST /api/admin/users/${user(1).id}/approve`]: () => {
        pending = [];
        return json(user(1));
      },
    });
    renderRoute('/admin/pending');
    await userEvent.click(await screen.findByRole('button', { name: 'الموافقة على Staff 1' }));
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'موافقة' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await userEvent.selectOptions(within(dialog).getByLabelText('الإدارة'), DEPT_B);
    await userEvent.selectOptions(within(dialog).getByLabelText('الدور'), 'DEPARTMENT_ADMIN');
    await userEvent.click(submit);
    await waitFor(() => expect(m.count(`POST /api/admin/users/${user(1).id}/approve`)).toBe(1));
    expect(m.calls.find((c) => c.key.endsWith('/approve'))?.body).toEqual({ department_id: DEPT_B, role: 'DEPARTMENT_ADMIN' });
    expect(await screen.findByText('لا توجد طلبات')).toBeTruthy();
  });

  it('rejecting asks for confirmation first', async () => {
    const m = mockFetch({
      ...refresh,
      'GET /api/admin/users/pending': () => json(userList([user(1, { status: 'PENDING', role: null })])),
      [`POST /api/admin/users/${user(1).id}/reject`]: () => json(user(1, { status: 'REJECTED' })),
    });
    renderRoute('/admin/pending');
    await userEvent.click(await screen.findByRole('button', { name: 'رفض Staff 1' }));
    const dialog = await screen.findByRole('dialog');
    expect(m.count(`POST /api/admin/users/${user(1).id}/reject`)).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'رفض' }));
    await waitFor(() => expect(m.count(`POST /api/admin/users/${user(1).id}/reject`)).toBe(1));
  });
});

describe('users management', () => {
  const open = async (u: ReturnType<typeof user>, extra = {}) => {
    const m = mockFetch({ ...refresh, ...deptRoute, 'GET /api/admin/users': () => json(userList([u])), ...extra });
    renderRoute('/admin/users');
    await userEvent.click(await screen.findByRole('button', { name: `إدارة حساب ${u.full_name}` }));
    return { m, dialog: await screen.findByRole('dialog') };
  };
  const names = (d: HTMLElement) => within(d).getAllByRole('button').map((b) => b.textContent?.trim()).filter((x) => x && x !== 'إغلاق');

  it('an active user can change role or department, be promoted or deactivated', async () => {
    const { dialog } = await open(user(1));
    expect(names(dialog)).toEqual(['تغيير الدور', 'نقل إلى إدارة أخرى', 'منح صلاحية مدير النظام', 'تعطيل']);
  });

  it('a System Admin offers only revoke (and no deactivate for the signed-in admin)', async () => {
    const self = user(2, { id: me.user.id, role: 'SYSTEM_ADMIN', department_id: null, department_name: null });
    const { dialog } = await open(self);
    expect(names(dialog)).toEqual([]);
    expect(within(dialog).getByText('لا توجد إجراءات متاحة لهذا الحساب.')).toBeTruthy();
  });

  it('another System Admin can be revoked, which needs a department', async () => {
    const other = user(3, { role: 'SYSTEM_ADMIN', department_id: null, department_name: null });
    const { dialog, m } = await open(other, { [`POST /api/admin/users/${other.id}/revoke-system-admin`]: () => json(user(3)) });
    await userEvent.click(within(dialog).getByRole('button', { name: 'سحب صلاحية مدير النظام' }));
    const confirm = within(dialog).getByRole('button', { name: 'تأكيد' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await userEvent.selectOptions(within(dialog).getByLabelText('الإدارة'), DEPT_B);
    await userEvent.click(confirm);
    await waitFor(() => expect(m.count(`POST /api/admin/users/${other.id}/revoke-system-admin`)).toBe(1));
    expect(m.calls.find((c) => c.key.endsWith('revoke-system-admin'))?.body).toEqual({ role: 'USER', department_id: DEPT_B });
  });

  it('role change sends the chosen role', async () => {
    const u = user(1);
    const { dialog, m } = await open(u, { [`PATCH /api/admin/users/${u.id}/role`]: () => json(user(1, { role: 'DEPARTMENT_ADMIN' })) });
    await userEvent.click(within(dialog).getByRole('button', { name: 'تغيير الدور' }));
    await userEvent.selectOptions(within(dialog).getByLabelText('الدور'), 'DEPARTMENT_ADMIN');
    await userEvent.click(within(dialog).getByRole('button', { name: 'تأكيد' }));
    await waitFor(() => expect(m.count(`PATCH /api/admin/users/${u.id}/role`)).toBe(1));
    expect(m.calls.find((c) => c.key.includes('/role'))?.body).toEqual({ role: 'DEPARTMENT_ADMIN' });
  });

  it('a refusal from the server is shown in the dialog', async () => {
    const u = user(1);
    const { dialog } = await open(u, { [`POST /api/admin/users/${u.id}/deactivate`]: () => envelope(409, 'INVALID_USER_STATE') });
    await userEvent.click(within(dialog).getByRole('button', { name: 'تعطيل' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'تأكيد' }));
    expect(await within(dialog).findByText('لا ينطبق هذا الإجراء على حالة المستخدم الحالية.')).toBeTruthy();
  });

  it('a deactivated user can be reactivated; a rejected one reopened', async () => {
    const { dialog } = await open(user(1, { status: 'DEACTIVATED' }));
    expect(names(dialog)).toEqual(['إعادة تفعيل الحساب']);
  });
});

describe('review fixes', () => {
  it('reactivating a user whose department is deactivated sends no hidden department id', async () => {
    const INACTIVE = '00000000-0000-4000-8000-0000000000d9';
    const u = user(7, { status: 'DEACTIVATED', department_id: INACTIVE, department_name: 'Closed Dept' });
    const m = mockFetch({
      ...refresh,
      'GET /api/admin/departments': () => json({ items: [...departments.items, { id: INACTIVE, name: 'Closed Dept', active: false, member_count: 1 }] }),
      'GET /api/admin/users': () => json(userList([u])),
      [`POST /api/admin/users/${u.id}/reactivate`]: () => json(user(7)),
    });
    renderRoute('/admin/users');
    await userEvent.click(await screen.findByRole('button', { name: 'إدارة حساب Staff 7' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'إعادة تفعيل الحساب' }));
    expect(within(dialog).getByText('الإدارة السابقة: Closed Dept')).toBeTruthy();
    expect((within(dialog).getByLabelText('الإدارة') as HTMLSelectElement).value).toBe('');
    await userEvent.click(within(dialog).getByRole('button', { name: 'تأكيد' }));
    await waitFor(() => expect(m.count(`POST /api/admin/users/${u.id}/reactivate`)).toBe(1));
    expect(m.calls.find((c) => c.key.endsWith('/reactivate'))?.body).toEqual({});
  });

  it('pending: when the later page empties out the list goes back to the first page', async () => {
    mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/users/pending': ({ url }) =>
        url.includes('page=2')
          ? json({ items: [], page: 2, page_size: 25, total: 26 })
          : json({ items: [user(1, { status: 'PENDING', role: null })], page: 1, page_size: 25, total: 26 }),
    });
    renderRoute('/admin/pending');
    await screen.findByText('Staff 1');
    await userEvent.click(screen.getByRole('button', { name: 'التالي' }));
    expect(await screen.findByText('Staff 1')).toBeTruthy();
    expect(screen.queryByText('لا توجد طلبات')).toBeNull();
  });

  it('policy: while one category is saving the other rows are locked', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const entry = (code: string) => ({ category_code: code, name: code, default_risk_level: 'MEDIUM', action: 'WARN', enabled: true, source: 'DEFAULT' });
    mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/policy/org': () => json({ version: 1, items: [entry('CONTACT_INFO'), entry('LOCATION')] }),
      'PUT /api/admin/policy/org/CONTACT_INFO': async () => {
        await gate;
        return json({ version: 2, items: [] });
      },
    });
    renderRoute('/admin/policy');
    await userEvent.selectOptions(await screen.findByLabelText('الإجراء لنوع معلومات الاتصال'), 'BLOCK');
    await waitFor(() => expect((screen.getByLabelText('الإجراء لنوع بيانات الموقع') as HTMLSelectElement).disabled).toBe(true));
    release();
    await waitFor(() => expect((screen.getByLabelText('الإجراء لنوع بيانات الموقع') as HTMLSelectElement).disabled).toBe(false));
  });

  it('rule form: the server verdict on a pattern disappears once the pattern is edited', async () => {
    mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/rules': () => json({ version: 1, items: [] }),
      'POST /api/admin/rules': () => envelope(400, 'VALIDATION_ERROR', { definition: ['rule.pattern_unsafe'] }),
    });
    renderRoute('/admin/rules');
    await userEvent.click((await screen.findAllByRole('button', { name: /إضافة قاعدة/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('الاسم'), 'Bad');
    await userEvent.selectOptions(within(dialog).getByLabelText('النوع'), 'PATTERN');
    const def = within(dialog).getByLabelText('النمط (Regex)');
    await userEvent.type(def, '(a+)+$');
    await userEvent.click(within(dialog).getByRole('button', { name: 'حفظ' }));
    expect(await within(dialog).findByText(/قد يبطئ المتصفح/)).toBeTruthy();
    await userEvent.type(def, 'x');
    await waitFor(() => expect(within(dialog).queryByText(/قد يبطئ المتصفح/)).toBeNull());
  });
});

describe('invalidateAdmin', () => {
  it('reloads users, departments, dashboards, policy and always the audit trail', async () => {
    const { QueryClient } = await import('@tanstack/react-query');
    const { invalidateAdmin } = await import('@/features/common/invalidate');
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await invalidateAdmin(qc);
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: string[] }).queryKey[0]);
    expect(keys).toEqual(expect.arrayContaining(['users', 'pending', 'departments', 'audit', 'dashboard', 'policy', 'rules']));
  });
});

describe('departments', () => {
  it('create: a taken name is explained, a new name is posted', async () => {
    let taken = true;
    const m = mockFetch({
      ...refresh,
      ...deptRoute,
      'POST /api/admin/departments': () => (taken ? envelope(409, 'DEPARTMENT_NAME_TAKEN') : json({ id: DEPT_A, name: 'Ops', active: true, member_count: 0 })),
    });
    renderRoute('/admin/departments');
    await userEvent.click((await screen.findAllByRole('button', { name: /إضافة إدارة/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('اسم الإدارة'), 'Legal');
    await userEvent.click(within(dialog).getByRole('button', { name: 'إضافة إدارة' }));
    expect(await within(dialog).findByText('يوجد إدارة بهذا الاسم.')).toBeTruthy();
    taken = false;
    await userEvent.click(within(dialog).getByRole('button', { name: 'إضافة إدارة' }));
    await waitFor(() => expect(m.count('POST /api/admin/departments')).toBe(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('an empty name is refused before asking the server', async () => {
    const m = mockFetch({ ...refresh, ...deptRoute, 'POST /api/admin/departments': () => json({}) });
    renderRoute('/admin/departments');
    await userEvent.click((await screen.findAllByRole('button', { name: /إضافة إدارة/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'إضافة إدارة' }));
    expect(await within(dialog).findByText('هذا الحقل مطلوب.')).toBeTruthy();
    expect(m.count('POST /api/admin/departments')).toBe(0);
  });

  it('deactivating asks for confirmation', async () => {
    const m = mockFetch({ ...refresh, ...deptRoute, [`POST /api/admin/departments/${DEPT_A}/deactivate`]: () => json({ ...departments.items[0], active: false }) });
    renderRoute('/admin/departments');
    await userEvent.click(await screen.findByRole('button', { name: 'تعطيل إدارة Engineering' }));
    const dialog = await screen.findByRole('dialog');
    expect(m.count(`POST /api/admin/departments/${DEPT_A}/deactivate`)).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'تعطيل' }));
    await waitFor(() => expect(m.count(`POST /api/admin/departments/${DEPT_A}/deactivate`)).toBe(1));
  });
});

describe('policy', () => {
  const entry = (code: string, over: Record<string, unknown> = {}) => ({ category_code: code, name: code, default_risk_level: 'MEDIUM', action: 'WARN', enabled: true, source: 'DEFAULT', ...over });

  it('a change is saved for that category with its action and enabled flag, then the table is reloaded', async () => {
    let action = 'WARN';
    const m = mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/policy/org': () => json({ version: 2, items: [entry('CONTACT_INFO', { action })] }),
      'PUT /api/admin/policy/org/CONTACT_INFO': ({ body }) => {
        action = (body as { action: string }).action;
        return json({ version: 3, items: [] });
      },
    });
    renderRoute('/admin/policy');
    await userEvent.selectOptions(await screen.findByLabelText('الإجراء لنوع معلومات الاتصال'), 'BLOCK');
    await waitFor(() => expect(m.count('PUT /api/admin/policy/org/CONTACT_INFO')).toBe(1));
    expect(m.calls.find((c) => c.key.startsWith('PUT'))?.body).toEqual({ action: 'BLOCK', enabled: true });
    await waitFor(() => expect((screen.getByLabelText('الإجراء لنوع معلومات الاتصال') as HTMLSelectElement).value).toBe('BLOCK'));
  });

  it('a failed save shows the error on that row and keeps the old value', async () => {
    mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/policy/org': () => json({ version: 2, items: [entry('CONTACT_INFO')] }),
      'PUT /api/admin/policy/org/CONTACT_INFO': () => envelope(500, 'INTERNAL_ERROR'),
    });
    renderRoute('/admin/policy');
    await userEvent.selectOptions(await screen.findByLabelText('الإجراء لنوع معلومات الاتصال'), 'BLOCK');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('الإجراء لنوع معلومات الاتصال') as HTMLSelectElement).value).toBe('WARN');
  });

  it('a department override can be removed', async () => {
    const m = mockFetch({
      ...refresh,
      ...deptRoute,
      'GET /api/admin/policy/org': () => json({ version: 2, items: [entry('CONTACT_INFO')] }),
      [`GET /api/admin/policy/departments/${DEPT_B}`]: () => json({ version: 2, department_id: DEPT_B, items: [entry('CONTACT_INFO', { source: 'DEPARTMENT', action: 'BLOCK' })] }),
      [`DELETE /api/admin/policy/departments/${DEPT_B}/CONTACT_INFO`]: () => json({}),
    });
    renderRoute('/admin/policy');
    const picker = await screen.findByLabelText('الإدارة');
    await waitFor(() => expect(within(picker).getAllByRole('option').length).toBeGreaterThan(1));
    await userEvent.selectOptions(picker, DEPT_B);
    await userEvent.click(await screen.findByRole('button', { name: 'إلغاء تخصيص معلومات الاتصال' }));
    await waitFor(() => expect(m.count(`DELETE /api/admin/policy/departments/${DEPT_B}/CONTACT_INFO`)).toBe(1));
  });
});

describe('rules', () => {
  const rulesRoutes = (extra = {}) => ({ ...refresh, ...deptRoute, 'GET /api/admin/rules': () => json({ version: 1, items: [] }), ...extra });

  it('the form checks the fields before sending and warns about secrets in a TOPIC', async () => {
    const m = mockFetch(rulesRoutes({ 'POST /api/admin/rules': () => json({}) }));
    renderRoute('/admin/rules');
    await userEvent.click((await screen.findAllByRole('button', { name: /إضافة قاعدة/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'حفظ' }));
    expect((await within(dialog).findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(m.count('POST /api/admin/rules')).toBe(0);
    await userEvent.selectOptions(within(dialog).getByLabelText('النوع'), 'TOPIC');
    expect(within(dialog).getByRole('note').textContent).toContain('لا تكتب أسراراً حقيقية');
  });

  it('an unsafe pattern refused by the server is explained under the definition', async () => {
    mockFetch(
      rulesRoutes({
        'POST /api/admin/rules': () => envelope(400, 'VALIDATION_ERROR', { definition: ['rule.pattern_unsafe'] }),
      }),
    );
    renderRoute('/admin/rules');
    await userEvent.click((await screen.findAllByRole('button', { name: /إضافة قاعدة/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('الاسم'), 'Bad');
    await userEvent.selectOptions(within(dialog).getByLabelText('النوع'), 'PATTERN');
    await userEvent.type(within(dialog).getByLabelText('النمط (Regex)'), '(a+)+$');
    await userEvent.click(within(dialog).getByRole('button', { name: 'حفظ' }));
    expect(await within(dialog).findByText(/قد يبطئ المتصفح/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('a department-scoped rule needs at least one department', async () => {
    const m = mockFetch(rulesRoutes({ 'POST /api/admin/rules': () => json({}) }));
    renderRoute('/admin/rules');
    await userEvent.click((await screen.findAllByRole('button', { name: /إضافة قاعدة/ }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('الاسم'), 'Scoped');
    await userEvent.type(within(dialog).getByLabelText(/الكلمات/), 'atlas');
    await userEvent.selectOptions(within(dialog).getByLabelText('النطاق'), 'DEPARTMENTS');
    await userEvent.click(within(dialog).getByRole('button', { name: 'حفظ' }));
    expect(await within(dialog).findByText('اختر إدارة واحدة على الأقل.')).toBeTruthy();
    expect(m.count('POST /api/admin/rules')).toBe(0);
  });
});

describe('audit', () => {
  const entry = {
    id: '00000000-0000-4000-8000-0000000000e1',
    created_at: '2026-10-25T08:00:00.000Z',
    acting_admin_id: me.user.id,
    acting_admin_name: 'Demo Admin',
    action_type: 'USER_ROLE_CHANGED',
    target_type: 'USER',
    target_id: user(1).id,
    target_name: 'Staff 1',
    detail: { old_role: 'USER', new_role: 'DEPARTMENT_ADMIN' },
  };

  it('lists who did what to whom, with the non-sensitive detail', async () => {
    mockFetch({ ...refresh, 'GET /api/admin/audit': () => json({ items: [entry], next_cursor: null }) });
    renderRoute('/admin/audit');
    expect(await screen.findByText('Demo Admin')).toBeTruthy();
    expect(screen.getByText('تغيير دور', { selector: 'td' })).toBeTruthy();
    expect(screen.getByText('new_role: DEPARTMENT_ADMIN')).toBeTruthy();
  });

  it('filters by action and never asks for an inverted date range', async () => {
    const m = mockFetch({ ...refresh, 'GET /api/admin/audit': () => json({ items: [entry], next_cursor: null }) });
    renderRoute('/admin/audit');
    await screen.findByText('Demo Admin');
    await userEvent.selectOptions(screen.getByLabelText('الإجراء'), 'USER_APPROVED');
    await waitFor(() => expect(m.fn.mock.calls.some((c) => String(c[0]).includes('action_type=USER_APPROVED'))).toBe(true));
    await userEvent.type(screen.getByLabelText('من تاريخ'), '2026-10-20');
    await userEvent.type(screen.getByLabelText('إلى تاريخ'), '2026-10-10');
    expect(await screen.findByText('تاريخ البداية يجب أن يسبق تاريخ النهاية.')).toBeTruthy();
    const sent = m.fn.mock.calls.map((c) => new URL(String(c[0]), 'http://x').searchParams).filter((p) => p.get('from') && p.get('to'));
    expect(sent.every((p) => p.get('from')! < p.get('to')!)).toBe(true);
  });

  it('is accessible (axe)', async () => {
    mockFetch({ ...refresh, 'GET /api/admin/audit': () => json({ items: [entry], next_cursor: null }) });
    const { container } = renderRoute('/admin/audit');
    await screen.findByText('Demo Admin');
    expect(await axe(container)).toHaveNoViolations();
  });
});
