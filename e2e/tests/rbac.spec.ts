import { expect, test } from '@playwright/test';
import { accounts, bearer, FORBIDDEN, open, signIn, tokenOf } from '../support';

/**
 * The role matrix (docs/ARCHITECTURE.md route map, contract/src/capabilities.ts), checked
 * from the outside: what each role can open in the browser, and what the API answers
 * to each role. The screen hides things for convenience; the API is the real gate.
 */

type Row = [path: string, title: string | null]; // null: the page must refuse the role

const SCREENS: Record<string, { email: string; rows: Row[] }> = {
  USER: {
    email: accounts.engUser,
    rows: [
      ['/dashboard', 'لوحة المؤشرات'],
      ['/activity', 'سجل النشاط'],
      ['/blocked', 'الرسائل المحظورة'],
      ['/profile', 'ملفي الشخصي'],
      ['/department/logs', null],
      ['/department/users', null],
      ['/admin/dashboard', null],
      ['/admin/users', null],
      ['/admin/audit', null],
    ],
  },
  DEPARTMENT_ADMIN: {
    email: accounts.engAdmin,
    rows: [
      ['/dashboard', 'لوحة الإدارة'],
      ['/department/logs', 'سجلات الإدارة'],
      ['/department/users', 'مستخدمو الإدارة'],
      ['/department/policy', 'سياسة الإدارة'],
      ['/department/rules', 'قواعد الكشف'],
      ['/profile', 'ملفي الشخصي'],
      ['/activity', null],
      ['/blocked', null],
      ['/admin/dashboard', null],
      ['/admin/users', null],
      ['/admin/audit', null],
    ],
  },
  SYSTEM_ADMIN: {
    email: accounts.admin,
    rows: [
      ['/admin/dashboard', 'لوحة المؤسسة'],
      ['/admin/logs', 'سجلات المؤسسة'],
      ['/admin/pending', 'طلبات الانضمام'],
      ['/admin/users', 'المستخدمون'],
      ['/admin/departments', 'الإدارات'],
      ['/admin/policy', 'السياسة'],
      ['/admin/rules', 'قواعد الكشف'],
      ['/admin/audit', 'سجل التدقيق'],
      ['/profile', 'ملفي الشخصي'],
      ['/dashboard', null],
      ['/activity', null],
      ['/department/logs', null],
    ],
  },
};

test.describe('screens per role', () => {
  for (const [role, { email, rows }] of Object.entries(SCREENS)) {
    test(`${role}: opens its screens and is refused the others`, async ({ page }) => {
      await signIn(page, email);
      for (const [path, title] of rows) {
        await open(page, path);
        if (title === null) {
          await expect(page.getByText(FORBIDDEN), `${role} ${path}`).toBeVisible();
        } else {
          await expect(page.getByRole('heading', { level: 1 }), `${role} ${path}`).toHaveText(title);
        }
      }
    });
  }

  test('a visitor who is not signed in is sent to sign-in from every private screen', async ({ page }) => {
    for (const path of ['/dashboard', '/activity', '/department/logs', '/admin/dashboard', '/admin/audit', '/profile']) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test('the sidebar shows only the screens of the role', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/dashboard');
    const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
    await expect(nav.getByRole('link', { name: 'سجل النشاط' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'سجلات الإدارة' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'سجل التدقيق' })).toHaveCount(0);
  });
});

/** [method, path, USER, DEPARTMENT_ADMIN, SYSTEM_ADMIN] */
const API: [string, string, number, number, number][] = [
  ['GET', '/api/dashboard/mine/summary', 200, 200, 200],
  ['GET', '/api/logs/mine', 200, 200, 200],
  ['GET', '/api/dashboard/department/summary', 403, 200, 400], // a System Admin must name the department
  ['GET', '/api/dashboard/department/top-users', 403, 200, 400],
  ['GET', '/api/dashboard/org/summary', 403, 403, 200],
  ['GET', '/api/admin/logs', 403, 200, 200],
  ['GET', '/api/admin/logs/export', 403, 200, 200],
  ['GET', '/api/admin/users', 403, 200, 200],
  ['GET', '/api/admin/users/pending', 403, 403, 200],
  ['GET', '/api/admin/departments', 403, 403, 200],
  ['GET', '/api/admin/rules', 403, 200, 200],
  ['GET', '/api/admin/audit', 403, 403, 200],
  ['PUT', '/api/admin/policy/org/CONTACT_INFO', 403, 403, 400], // a System Admin with an empty body: refused as invalid, not as forbidden
  ['POST', '/api/admin/rules', 403, 400, 400],
  ['POST', '/api/admin/departments', 403, 403, 400],
];

test.describe('API answers per role', () => {
  test('every endpoint answers as the capability matrix says', async ({ request }) => {
    const tokens = {
      USER: await tokenOf(request, accounts.engUser),
      DEPARTMENT_ADMIN: await tokenOf(request, accounts.engAdmin),
      SYSTEM_ADMIN: await tokenOf(request, accounts.admin),
    };
    const problems: string[] = [];
    for (const [method, path, user, da, sa] of API) {
      for (const [role, expected] of [['USER', user], ['DEPARTMENT_ADMIN', da], ['SYSTEM_ADMIN', sa]] as const) {
        const res = await request.fetch(path, { method, headers: bearer(tokens[role]), data: method === 'GET' ? undefined : {} });
        if (res.status() !== expected) problems.push(`${role} ${method} ${path}: ${res.status()} (expected ${expected})`);
      }
    }
    expect(problems).toEqual([]);
  });

  test('without a token every private endpoint is 401', async ({ request }) => {
    for (const [method, path] of API) {
      const res = await request.fetch(path, { method, data: method === 'GET' ? undefined : {} });
      expect(res.status(), `${method} ${path}`).toBe(401);
    }
  });

  test('a Department Admin only ever sees their own department, whatever the request asks for', async ({ request }) => {
    const eng = await tokenOf(request, accounts.engAdmin);
    const finance = await request.get('/api/admin/users?page_size=100', { headers: bearer(await tokenOf(request, accounts.admin)) });
    const financeDept = (await finance.json()).items.find((u: { department_name: string }) => u.department_name === 'E2E Finance').department_id;

    for (const path of [`/api/admin/logs?department_id=${financeDept}&page_size=100`, '/api/admin/logs?page_size=100']) {
      const body = await (await request.get(path, { headers: bearer(eng) })).json();
      expect(body.items.length).toBeGreaterThan(0);
      expect(new Set(body.items.map((l: { department_name: string }) => l.department_name))).toEqual(new Set(['E2E Engineering']));
    }
    const users = await (await request.get('/api/admin/users?page_size=100', { headers: bearer(eng) })).json();
    expect(new Set(users.items.map((u: { department_name: string }) => u.department_name))).toEqual(new Set(['E2E Engineering']));
    // Another department's policy and a user outside the department are refused or hidden, not leaked.
    expect((await request.get(`/api/admin/policy/departments/${financeDept}`, { headers: bearer(eng) })).status()).toBe(403);
  });

  test('a user cannot read another user’s logs by guessing an identifier', async ({ request }) => {
    const user = await tokenOf(request, accounts.engUser);
    const admin = await tokenOf(request, accounts.admin);
    const financeLog = (await (await request.get('/api/admin/logs?page_size=100', { headers: bearer(admin) })).json()).items.find(
      (l: { department_name: string }) => l.department_name === 'E2E Finance',
    );
    expect((await request.get(`/api/admin/logs/${financeLog.log_id}`, { headers: bearer(user) })).status()).toBe(403);
    // A Department Admin of another department gets "not found", never the row.
    expect((await request.get(`/api/admin/logs/${financeLog.log_id}`, { headers: bearer(await tokenOf(request, accounts.engAdmin)) })).status()).toBe(404);
  });
});
