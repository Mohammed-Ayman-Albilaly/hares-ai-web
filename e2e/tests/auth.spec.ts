import { expect, test } from '@playwright/test';
import { accounts, open, PASSWORD, signInThroughForm, signOut } from '../support';

test.describe('sign-in and session', () => {
  test('a wrong password is refused with a clear message and nobody is signed in', async ({ page }) => {
    await signInThroughForm(page, accounts.engUser, 'Wrong#Pass999');
    await expect(page.getByRole('alert')).toContainText('غير صحيحة');
    await expect(page).toHaveURL(/\/login/);
  });

  test('each role lands on its own home, a reload keeps the session, and sign-out ends it', async ({ page }) => {
    await signInThroughForm(page, accounts.admin);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('لوحة المؤسسة');

    await signOut(page);

    // The session is really gone: a private page sends the visitor back to sign-in.
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the refresh token is an HttpOnly, Strict cookie scoped to /api/auth, and no token is kept in web storage', async ({ page, context }) => {
    await signInThroughForm(page, accounts.engUser);
    await expect(page).toHaveURL(/\/dashboard/);
    const cookie = (await context.cookies()).find((c) => c.name === 'hares_rt');
    expect(cookie, 'refresh cookie').toBeTruthy();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/auth' });

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT anywhere in web storage
    expect(await page.evaluate(() => document.cookie)).not.toContain('hares_rt'); // not readable by scripts
  });

  test('signing out in one tab signs the other tab out', async ({ page, context }) => {
    await signInThroughForm(page, accounts.engUser);
    await expect(page).toHaveURL(/\/dashboard/);
    const second = await context.newPage();
    await open(second, '/profile');
    await signOut(page);
    await expect(second).toHaveURL(/\/login/);
  });

  test('a signed-in visitor opening the sign-in page is sent to their home', async ({ page }) => {
    await signInThroughForm(page, accounts.engAdmin);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('after the failed-login limit the form says how long to wait', async ({ page }) => {
    // A dedicated account: the throttle is per account and address, other tests are unaffected.
    const email = accounts.throttled;
    const attempt = async (password: string) => {
      await page.goto('/login');
      await page.getByLabel('البريد الإلكتروني').fill(email);
      await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/api/auth/login')),
        page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click(),
      ]);
      return res.status();
    };
    let status = 401;
    for (let i = 0; i < 12 && status !== 429; i++) status = await attempt(`Wrong#Pass${i}00`);
    expect(status, 'the throttle must kick in after repeated failures').toBe(429);
    await expect(page.getByText(/حاول مرة أخرى بعد \d+ ثانية/)).toBeVisible();
    // The correct password is refused too while the wait lasts (guessing right later cannot bypass it).
    expect(await attempt(PASSWORD)).toBe(429);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('registration and approval', () => {
  const email = `new.${Date.now()}@e2e.test`;

  test('register, wait for approval, get approved by the System Admin, sign in', async ({ page, browser }) => {
    // 1. register
    await page.goto('/register');
    await page.getByLabel('الاسم الكامل').fill('Newcomer Test');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(PASSWORD);
    await page.getByLabel('تأكيد كلمة المرور').fill(PASSWORD);
    await page.getByRole('button', { name: 'إرسال الطلب' }).click();
    await expect(page.getByText('تم استلام طلبك')).toBeVisible();

    // 2. cannot sign in yet: the page says why
    await signInThroughForm(page, email);
    await expect(page.getByRole('alert')).toContainText('بانتظار موافقة');

    // 3. the System Admin approves into a department
    const adminCtx = await browser.newContext({ locale: 'ar-SA' });
    const admin = await adminCtx.newPage();
    await signInThroughForm(admin, accounts.admin);
    await expect(admin).toHaveURL(/\/admin\/dashboard/);
    await admin.goto('/admin/pending');
    await admin.getByRole('button', { name: 'الموافقة على Newcomer Test' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByLabel('الإدارة').selectOption({ label: 'E2E Legal' });
    await dialog.getByRole('button', { name: 'موافقة', exact: true }).click();
    await expect(admin.getByRole('dialog')).toBeHidden();
    await adminCtx.close();

    // 4. now the newcomer signs in and sees an honest empty dashboard
    await signInThroughForm(page, email);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('لا يوجد نشاط في هذه الفترة')).toBeVisible();
  });
});
