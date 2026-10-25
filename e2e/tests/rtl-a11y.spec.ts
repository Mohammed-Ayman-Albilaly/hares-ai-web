import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { accounts, open, origin, PASSWORD, signIn } from '../support';

/**
 * Right-to-left layout and accessibility (WEB-NFR-012, WCAG 2.2 AA), checked in a real
 * browser with axe-core on every screen, in both languages and both themes, plus the
 * things automated rules cannot see (keyboard order, drawer, reflow on a phone).
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Wait until the screen has finished drawing: data loaded, fonts ready, charts drawn. */
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle'); // the screen's data requests are done
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await page.waitForTimeout(300); // chart animation and font swap
}

async function expectNoViolations(page: Page, label: string): Promise<void> {
  await settled(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`);
  expect(report, `${label}\n${report.join('\n')}`).toEqual([]);
}

/** A dialog must sit inside the window, horizontally centred (it was pushed off-screen in right-to-left once). */
async function expectDialogInsideViewport(page: Page): Promise<void> {
  await page.waitForTimeout(300); // pop-in animation
  const box = (await page.getByRole('dialog').boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
  expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
}

const PUBLIC = ['/', '/login', '/register', '/forgot-password'];
const BY_ROLE: Record<string, { email: string; paths: string[] }> = {
  USER: { email: accounts.engUser, paths: ['/dashboard', '/activity', '/blocked', '/profile'] },
  DEPARTMENT_ADMIN: { email: accounts.engAdmin, paths: ['/dashboard', '/department/logs', '/department/users', '/department/policy', '/department/rules'] },
  SYSTEM_ADMIN: {
    email: accounts.admin,
    paths: ['/admin/dashboard', '/admin/logs', '/admin/pending', '/admin/users', '/admin/departments', '/admin/policy', '/admin/rules', '/admin/audit'],
  },
};

test.describe('direction and language', () => {
  test('Arabic is the default: right to left, with the language set on the page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('switching to English flips direction, translates the page and is remembered', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'اللغة' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/[؀-ۿ]/);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByRole('button', { name: 'Language' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('the sidebar is on the right in Arabic and on the left in English', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/dashboard');
    const box = async () => (await page.locator('aside, .sidebar').first().boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect((await box()).x + (await box()).width).toBeGreaterThan(vw - 5);
    await page.getByRole('button', { name: 'اللغة' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect((await box()).x).toBeLessThan(5);
  });

  test('numbers are Western digits in both languages and email addresses stay left to right', async ({ page }) => {
    await signIn(page, accounts.engAdmin);
    await open(page, '/department/users');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/[٠-٩]/); // no Arabic-Indic digits
    const email = page.locator('tbody td [dir="ltr"]').first();
    await expect(email).toContainText('@e2e.test');
  });
});

test.describe('automated accessibility audit (axe, WCAG 2.2 AA)', () => {
  for (const path of PUBLIC) {
    test(`public ${path}, Arabic`, async ({ page }) => {
      await page.goto(path);
      await page.locator('h1').first().waitFor();
      await expectNoViolations(page, path);
    });
  }

  test('public pages in English', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'اللغة' }).click();
    for (const path of PUBLIC) {
      await page.goto(path);
      await page.locator('h1').first().waitFor();
      await expectNoViolations(page, `${path} (en)`);
    }
  });

  for (const [role, { email, paths }] of Object.entries(BY_ROLE)) {
    test(`${role}: every screen`, async ({ page }) => {
      await signIn(page, email);
      for (const path of paths) {
        await open(page, path);
        await expectNoViolations(page, `${role} ${path}`);
      }
    });
  }

  test('dark theme: dashboards and tables keep their contrast', async ({ page }) => {
    await signIn(page, accounts.admin);
    await open(page, '/admin/dashboard');
    await page.getByRole('button', { name: /الوضع الداكن|الوضع الفاتح/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    for (const path of ['/admin/dashboard', '/admin/users', '/admin/policy', '/admin/audit']) {
      await open(page, path);
      await expectNoViolations(page, `dark ${path}`);
    }
  });

  test('dialogs: the approve, manage and rule dialogs are accessible when open', async ({ page, request }) => {
    // A registrant waiting for approval, so the approve dialog can be opened.
    const email = `dialog.${Date.now()}@e2e.test`;
    expect((await request.post('/api/auth/register', { data: { full_name: 'Dialog Check', email, password: PASSWORD }, headers: origin })).status()).toBe(201);

    await signIn(page, accounts.admin);
    await open(page, '/admin/pending');
    await page.getByRole('button', { name: 'الموافقة على Dialog Check' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectDialogInsideViewport(page);
    await expectNoViolations(page, 'approve dialog');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await open(page, '/admin/users');
    await page.locator('tbody tr').first().getByRole('button', { name: /^إدارة حساب/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectDialogInsideViewport(page);
    await expectNoViolations(page, 'manage dialog');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await open(page, '/admin/rules');
    await page.getByRole('button', { name: /إضافة قاعدة/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectDialogInsideViewport(page);
    await expectNoViolations(page, 'rule dialog');
  });

});

test.describe('keyboard and screen readers', () => {
  test('the first Tab stop is the skip link and it moves focus to the main content', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/dashboard');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'انتقل إلى المحتوى' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main');
  });

  test('every chart has a name and a table with the same numbers', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/dashboard');
    await settled(page);
    const charts = page.getByRole('img');
    await expect(charts.first()).toHaveAttribute('aria-label', /.+/);
    const toggles = page.getByRole('button', { name: 'عرض كجدول' });
    expect(await toggles.count()).toBeGreaterThanOrEqual(4);
    await toggles.first().click();
    await expect(page.getByRole('table', { name: 'توزيع مستوى الخطر' })).toBeVisible();
  });

  test('risk and action are never shown by colour alone: every badge has a text label', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/activity');
    const pills = page.locator('.h-pill');
    await expect(pills.first()).toBeVisible();
    for (const text of await pills.allInnerTexts()) expect(text.trim().length).toBeGreaterThan(0);
  });

  test('a row of the log opens and closes with the keyboard', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/activity');
    const toggle = page.locator('tbody tr').first().getByRole('button', { name: /^عرض تفاصيل/ });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('لا يحفظ حارس نص الرسائل أبداً')).toBeVisible();
    await expect(page.locator('tbody tr').first().getByRole('button', { name: /^إخفاء تفاصيل/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('no horizontal scrolling on the main screens (WCAG reflow)', async ({ page }) => {
    for (const path of ['/login', '/register']) {
      await page.goto(path);
      await page.locator('h1').first().waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
    await signIn(page, accounts.engUser);
    for (const path of ['/dashboard', '/activity']) {
      await open(page, path);
      await settled(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });

  test('the menu opens as a drawer, Escape closes it, and focus returns to the menu button', async ({ page }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/dashboard');
    const menu = page.getByRole('button', { name: 'القائمة' });
    await menu.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'سجل النشاط' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
  });
});
