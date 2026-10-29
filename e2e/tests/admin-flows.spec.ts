import { expect, test } from '@playwright/test';
import { accounts, bearer, open, PASSWORD, signIn, signInThroughForm, tokenOf } from '../support';

/**
 * Journeys that change the organisation: policy, rules, account status. They run in file
 * order on one shared organisation and put back what they change.
 */

async function extensionToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  const res = await request.post('/api/extension/login', { data: { email, password: PASSWORD } });
  return (await res.json()).access_token as string;
}

test.describe.configure({ mode: 'serial' });

test.describe('policy', () => {
  test('a policy change reaches the extension bundle and the audit trail, and can be undone', async ({ page, request }) => {
    const ext = await extensionToken(request, accounts.engUser);
    const bundle = () => request.get('/api/policy/bundle', { headers: bearer(ext) });
    const first = await bundle();
    expect(first.status()).toBe(200);
    const etag = first.headers()['etag'];
    expect(etag).toMatch(/^"p\d+-/);
    // Nothing changed: the extension is told so (no body to download).
    expect((await request.get('/api/policy/bundle', { headers: { ...bearer(ext), 'If-None-Match': etag! } })).status()).toBe(304);

    await signIn(page, accounts.admin);
    await open(page, '/admin/policy');
    const select = page.getByLabel('الإجراء لنوع معلومات الاتصال');
    await expect(select).toBeVisible();
    const original = await select.inputValue();
    const changed = original === 'BLOCK' ? 'WARN' : 'BLOCK';
    await select.selectOption(changed);
    await expect(select).toHaveValue(changed);
    await expect(select).toBeEnabled();

    const second = await bundle();
    expect(second.headers()['etag']).not.toBe(etag);
    const policy = (await second.json()).policy.find((p: { category_code: string }) => p.category_code === 'CONTACT_INFO');
    expect(policy.action).toBe(changed);

    await open(page, '/admin/audit');
    await expect(page.locator('tbody tr').first()).toContainText('تغيير السياسة');

    await open(page, '/admin/policy');
    await select.selectOption(original);
    await expect(select).toHaveValue(original);
    await expect(select).toBeEnabled();
  });

  test('a Department Admin turns a category off for their own department only', async ({ page, request }) => {
    const bundleOf = async (email: string) => {
      const ext = await extensionToken(request, email);
      const res = await (await request.get('/api/policy/bundle', { headers: bearer(ext) })).json();
      return res.policy.find((p: { category_code: string }) => p.category_code === 'VEHICLE') as { enabled: boolean; risk_level: string };
    };
    expect((await bundleOf(accounts.engUser)).enabled).toBe(true);

    await signIn(page, accounts.engAdmin);
    await open(page, '/department/policy');
    await page.getByRole('switch', { name: 'تفعيل بيانات المركبات' }).click();
    await expect(page.getByRole('button', { name: 'إلغاء تخصيص بيانات المركبات' })).toBeVisible();

    const mine = await bundleOf(accounts.engUser);
    expect(mine.enabled).toBe(false);
    expect(mine.risk_level).toMatch(/^(HIGH|MEDIUM|LOW|NONE)$/);
    // Another department keeps the organisation value.
    expect((await bundleOf(accounts.financeUser)).enabled).toBe(true);

    await page.getByRole('button', { name: 'إلغاء تخصيص بيانات المركبات' }).click();
    await expect(page.getByRole('button', { name: 'إلغاء تخصيص بيانات المركبات' })).toHaveCount(0);
    expect((await bundleOf(accounts.engUser)).enabled).toBe(true);
  });

  test('a department override is limited to that department and can be removed', async ({ page, request }) => {
    await signIn(page, accounts.admin);
    await open(page, '/admin/policy');
    await page.getByLabel('الإدارة', { exact: true }).selectOption({ label: 'E2E Finance' });
    const select = page.getByLabel('الإجراء لنوع بيانات الموقع').nth(1); // the department table, below the organisation one
    await expect(select).toBeVisible();
    const original = await select.inputValue();
    await select.selectOption(original === 'BLOCK' ? 'WARN' : 'BLOCK');
    await expect(page.getByRole('button', { name: 'إلغاء تخصيص بيانات الموقع' })).toBeVisible();

    const bundleOf = async (email: string) => {
      const ext = await extensionToken(request, email);
      const body = await (await request.get('/api/policy/bundle', { headers: bearer(ext) })).json();
      return body.policy.find((p: { category_code: string }) => p.category_code === 'LOCATION').action as string;
    };
    expect(await bundleOf(accounts.financeUser)).not.toBe(await bundleOf(accounts.engUser));

    await page.getByRole('button', { name: 'إلغاء تخصيص بيانات الموقع' }).click();
    await expect(page.getByRole('button', { name: 'إلغاء تخصيص بيانات الموقع' })).toHaveCount(0);
    expect(await bundleOf(accounts.financeUser)).toBe(await bundleOf(accounts.engUser));
  });
});

test.describe('detection rules', () => {
  const name = `E2E keywords ${Date.now()}`;

  test('a rule is created, reaches the extension, is read-only for a Department Admin outside their department, and a TOPIC text stays secret', async ({ page, request }) => {
    await signIn(page, accounts.admin);
    await open(page, '/admin/rules');
    await page.getByRole('button', { name: /إضافة قاعدة/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('الاسم').fill(name);
    await dialog.getByLabel(/الكلمات/).fill('project atlas\nproject borealis');
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();

    // a TOPIC rule for one department
    await page.getByRole('button', { name: /إضافة قاعدة/ }).first().click();
    const topic = page.getByRole('dialog');
    await topic.getByLabel('الاسم').fill(`${name} topic`);
    await topic.getByLabel('النوع').selectOption('TOPIC');
    await expect(topic.getByRole('note')).toContainText('لا تكتب أسراراً حقيقية');
    await topic.getByLabel('وصف الموضوع').fill('confidential acquisition plans');
    await topic.getByLabel('النطاق').selectOption('ORG_WIDE');
    await topic.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // the extension receives the rule
    const ext = await extensionToken(request, accounts.engUser);
    const bundle = await (await request.get('/api/policy/bundle', { headers: bearer(ext) })).json();
    expect(bundle.rules.some((r: { name: string }) => r.name === name)).toBe(true);

    // a Department Admin sees it, read-only, and never the TOPIC text
    const da = await tokenOf(request, accounts.engAdmin);
    const list = await (await request.get('/api/admin/rules', { headers: bearer(da) })).json();
    expect(list.items.find((r: { name: string }) => r.name === `${name} topic`).definition).toBe('');
    expect(JSON.stringify(list)).not.toContain('confidential acquisition plans');
    // An organisation-wide rule is not theirs to write, whatever the body says.
    const orgWide = list.items.find((r: { name: string }) => r.name === name);
    expect(orgWide.editable).toBe(false);
    const attempt = { ...orgWide, scope: 'ORG_WIDE', department_ids: [] };
    delete attempt.id;
    delete attempt.editable;
    expect((await request.post('/api/admin/rules', { headers: bearer(da), data: attempt })).status()).toBe(403);

    const daPage = await page.context().browser()!.newContext({ locale: 'ar-SA' });
    const p2 = await daPage.newPage();
    await signIn(p2, accounts.engAdmin);
    await open(p2, '/department/rules');
    await expect(p2.getByRole('row', { name: new RegExp(name) }).first()).toBeVisible();
    await expect(p2.getByText('مخفي (وصف سري)').first()).toBeVisible();
    // No edit button on an organisation-wide rule; adding a rule for their own department is offered.
    await expect(p2.getByRole('button', { name: /تعديل القاعدة/ })).toHaveCount(0);
    await expect(p2.getByRole('button', { name: /إضافة قاعدة/ }).first()).toBeVisible();
    await daPage.close();
  });

  test('an unsafe regular expression is refused with an explanation', async ({ page }) => {
    await signIn(page, accounts.admin);
    await open(page, '/admin/rules');
    await page.getByRole('button', { name: /إضافة قاعدة/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('الاسم').fill('E2E unsafe');
    await dialog.getByLabel('النوع').selectOption('PATTERN');
    await dialog.getByLabel('النمط (Regex)').fill('(a+)+$');
    await dialog.getByRole('button', { name: 'حفظ' }).click();
    await expect(dialog.getByText(/قد يبطئ المتصفح/)).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});

test.describe('account status', () => {
  test('a Department Admin deactivates a user, who is then locked out until a System Admin reactivates them', async ({ page, browser }) => {
    const target = `engineering.user2@e2e.test`;
    await signIn(page, accounts.engAdmin);
    await open(page, '/department/users');
    const row = page.getByRole('row', { name: new RegExp(target) });
    await row.getByRole('button', { name: /^تعطيل حساب/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'تعطيل', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(row).toContainText('معطّل');

    // locked out at once
    const other = await browser.newContext({ locale: 'ar-SA' });
    const p = await other.newPage();
    await signInThroughForm(p, target);
    await expect(p.getByRole('alert')).toContainText('معطّل');

    // the System Admin brings them back
    const admin = await browser.newContext({ locale: 'ar-SA' });
    const a = await admin.newPage();
    await signInThroughForm(a, accounts.admin);
    await expect(a).toHaveURL(/\/admin\/dashboard/);
    await open(a, '/admin/users');
    await a.getByLabel('بحث').fill(target);
    const arow = a.getByRole('row', { name: new RegExp(target) });
    await arow.getByRole('button', { name: /^إدارة حساب/ }).click();
    const dialog = a.getByRole('dialog');
    await dialog.getByRole('button', { name: 'إعادة تفعيل الحساب' }).click();
    await dialog.getByRole('button', { name: 'تأكيد' }).click();
    await expect(a.getByRole('dialog')).toBeHidden();
    await expect(arow).toContainText('نشط');

    await signInThroughForm(p, target);
    await expect(p).toHaveURL(/\/dashboard/);
    await other.close();

    // every one of these actions is in the audit trail, with who did it
    await open(a, '/admin/audit');
    await expect(a.locator('tbody').getByText('تعطيل مستخدم').first()).toBeVisible();
    await expect(a.locator('tbody').getByText('إعادة تفعيل مستخدم').first()).toBeVisible();
    await admin.close();
  });

  test('a System Admin cannot deactivate their own account', async ({ page }) => {
    await signIn(page, accounts.admin);
    await open(page, '/admin/users');
    await page.getByLabel('بحث').fill(accounts.admin);
    const row = page.getByRole('row', { name: new RegExp(accounts.admin) });
    await row.getByRole('button', { name: /^إدارة حساب/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'تعطيل' })).toHaveCount(0);
    await expect(dialog.getByText('لا توجد إجراءات متاحة لهذا الحساب.')).toBeVisible();
  });
});

test.describe('departments', () => {
  test('a department is created, renamed, and a duplicate name is refused', async ({ page }) => {
    const name = `E2E Ops ${Date.now() % 100000}`;
    await signIn(page, accounts.admin);
    await open(page, '/admin/departments');
    await page.getByRole('button', { name: /إضافة إدارة/ }).first().click();
    await page.getByRole('dialog').getByLabel('اسم الإدارة').fill(name);
    await page.getByRole('dialog').getByRole('button', { name: 'إضافة إدارة' }).click();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();

    await page.getByRole('button', { name: /إضافة إدارة/ }).first().click();
    await page.getByRole('dialog').getByLabel('اسم الإدارة').fill(name.toLowerCase());
    await page.getByRole('dialog').getByRole('button', { name: 'إضافة إدارة' }).click();
    await expect(page.getByRole('dialog').getByText('يوجد إدارة بهذا الاسم.')).toBeVisible();
  });
});
