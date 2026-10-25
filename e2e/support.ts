import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** The demo organisation created by api/src/test/e2e-env.ts (synthetic people, example domain). */
export const PASSWORD = 'Demo#Pass123';
export const DOMAIN = 'e2e.test';
export const accounts = {
  admin: `admin.demo@${DOMAIN}`,
  engAdmin: `engineering.admin@${DOMAIN}`,
  engUser: `engineering.user1@${DOMAIN}`,
  financeAdmin: `finance.admin@${DOMAIN}`,
  financeUser: `finance.user1@${DOMAIN}`,
  // Only the throttle test fails sign-ins on this one, so no other test is locked out.
  throttled: `legal.user2@${DOMAIN}`,
} as const;

export const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:1520';

/** Headers the API's Origin check expects from a browser-like client. */
export const origin = { Origin: baseURL };

/**
 * Sign in without the form (fast): the answer sets the refresh cookie in the
 * browser context, so the next page load restores the session by itself, exactly
 * like a returning visitor. Returns the access token for direct API calls.
 */
export async function signIn(page: Page, email: string, password = PASSWORD): Promise<string> {
  const res = await page.request.post('/api/auth/login', { data: { email, password }, headers: origin });
  expect(res.status(), `sign-in of ${email}`).toBe(200);
  return (await res.json()).access_token as string;
}

/** Access token of an account, for API checks that need no browser page. */
export async function tokenOf(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email, password: PASSWORD }, headers: origin });
  expect(res.status(), `sign-in of ${email}`).toBe(200);
  return (await res.json()).access_token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}`, ...origin });

/** The sign-in form, filled and sent. */
export async function signInThroughForm(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
}

/** Open a page and wait until the application has finished starting (session restored, screen drawn). */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.locator('h1, [role="alert"]').first().waitFor();
}

export const FORBIDDEN = 'لا تملك صلاحية لهذه الصفحة';

/** Sign out through the user menu in the top bar. */
export async function signOut(page: Page): Promise<void> {
  await page.locator('header [aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/login/);
}
