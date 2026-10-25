import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { accounts, bearer, open, origin, PASSWORD, signIn, tokenOf } from '../support';

/** CSV export (WEB-FR-025/066): administrators only, scoped like the list, metadata only. */

async function exportedRows(download: import('@playwright/test').Download): Promise<{ text: string; header: string[]; rows: string[][] }> {
  const path = await download.path();
  const text = await readFile(path, 'utf8');
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  return { text, header: lines[0]!.split(','), rows: lines.slice(1).map((l) => l.split(',')) };
}

test.describe('CSV export', () => {
  test('a Department Admin downloads their department only, with a header and no message text', async ({ page }) => {
    await signIn(page, accounts.engAdmin);
    await open(page, '/department/logs');
    await expect(page.locator('tbody tr').first()).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^activity-logs-\d{8}\.csv$/);
    const { text, header, rows } = await exportedRows(download);

    expect(text.startsWith('\uFEFF'), 'UTF-8 byte order mark for Excel').toBe(true);
    expect(header).toEqual(['log_id', 'event_time', 'user_name', 'user_email', 'department', 'platform', 'risk_level', 'action', 'user_decision', 'categories', 'classification_source', 'rule_id']);
    expect(rows.length).toBeGreaterThan(5);
    const dept = header.indexOf('department');
    expect(new Set(rows.map((r) => r[dept]))).toEqual(new Set(['E2E Engineering']));
    expect(header.some((h) => /prompt|text|message|content/i.test(h))).toBe(false);
  });

  test('the export follows the filters on screen', async ({ page }) => {
    await signIn(page, accounts.engAdmin);
    await open(page, '/department/logs');
    await page.getByLabel('مستوى الخطر').selectOption('HIGH');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير CSV' }).click()]);
    const { header, rows } = await exportedRows(download);
    const risk = header.indexOf('risk_level');
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r[risk]))).toEqual(new Set(['HIGH']));
  });

  test('the System Admin export covers every department', async ({ page }) => {
    await signIn(page, accounts.admin);
    await open(page, '/admin/logs');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير CSV' }).click()]);
    const { header, rows } = await exportedRows(download);
    expect(new Set(rows.map((r) => r[header.indexOf('department')])).size).toBeGreaterThan(1);
  });

  test('a user has no export: the button is not on their screens and the API refuses', async ({ page, request }) => {
    await signIn(page, accounts.engUser);
    await open(page, '/activity');
    await expect(page.getByRole('button', { name: 'تصدير CSV' })).toHaveCount(0);
    const res = await request.get('/api/admin/logs/export', { headers: bearer(await tokenOf(request, accounts.engUser)) });
    expect(res.status()).toBe(403);
  });

  test('a name that starts like a formula is exported neutralised (CSV injection)', async ({ request }) => {
    // The attack surface: a name the person chose themselves when registering.
    const admin = await tokenOf(request, accounts.admin);
    const email = `formula.${Date.now()}@e2e.test`;
    const name = '=1+1 Formula';
    expect((await request.post('/api/auth/register', { data: { full_name: name, email, password: PASSWORD }, headers: origin })).status()).toBe(201);
    const pending = (await (await request.get('/api/admin/users/pending?page_size=100', { headers: bearer(admin) })).json()).items;
    const person = pending.find((u: { email: string }) => u.email === email);
    const dept = (await (await request.get('/api/admin/departments', { headers: bearer(admin) })).json()).items.find((d: { name: string }) => d.name === 'E2E Legal');
    expect((await request.post(`/api/admin/users/${person.id}/approve`, { headers: bearer(admin), data: { department_id: dept.id, role: 'USER' } })).status()).toBe(200);
    const ext = (await (await request.post('/api/extension/login', { data: { email, password: PASSWORD } })).json()).access_token as string;
    const event = { log_id: randomUUID(), event_time: new Date().toISOString(), platform: 'CLAUDE', risk_level: 'LOW', action: 'ALLOWED', categories: [], classification_source: 'LOCAL', user_decision: 'NONE', schema_version: 1 };
    expect((await request.post('/api/logs', { headers: bearer(ext), data: event })).status()).toBe(201);

    const csv = (await (await request.get('/api/admin/logs/export', { headers: bearer(admin) })).text()).replace(/^\uFEFF/, '');
    const line = csv.split(/\r?\n/).find((l) => l.includes(event.log_id));
    expect(line, 'the exported row').toBeTruthy();
    // Spreadsheet programs run a cell that starts with = + - @ as a formula: it must be prefixed so it is text.
    expect(line).toMatch(/(^|,)"?'=1\+1 Formula/);
    expect(line).not.toMatch(/(^|,)"?=1\+1/);
  });
});
