import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { accounts, bearer, open, PASSWORD, signIn, tokenOf } from '../support';

/**
 * What the browser extension does, done over HTTP: sign in with the extension
 * client, send metadata-only events, and see them in the web app.
 */
async function extensionToken(request: import('@playwright/test').APIRequestContext, email: string): Promise<string> {
  const res = await request.post('/api/extension/login', { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
  return (await res.json()).access_token as string;
}

const event = (over: Record<string, unknown> = {}) => ({
  log_id: randomUUID(),
  event_time: new Date().toISOString(),
  platform: 'GEMINI',
  risk_level: 'HIGH',
  action: 'BLOCKED',
  categories: ['HEALTH_MEDICAL'],
  classification_source: 'LOCAL',
  user_decision: 'CANCELLED',
  schema_version: 1,
  ...over,
});

test.describe('ingestion from the extension', () => {
  test('an event is stored once, counted once, and shows up in the web app', async ({ page, request }) => {
    const web = await tokenOf(request, accounts.engUser);
    const summary = async () => (await (await request.get('/api/dashboard/mine/summary', { headers: bearer(web) })).json()).totals;
    const before = await summary();

    const ext = await extensionToken(request, accounts.engUser);
    const e = event();
    expect((await request.post('/api/logs', { headers: bearer(ext), data: e })).status()).toBe(201);
    // The same event again (a retry after a network drop) is acknowledged but not counted twice.
    expect((await request.post('/api/logs', { headers: bearer(ext), data: e })).status()).toBe(200);

    const after = await summary();
    expect(after.total_events).toBe(before.total_events + 1);
    expect(after.blocked).toBe(before.blocked + 1);

    await signIn(page, accounts.engUser);
    await open(page, '/blocked');
    const first = page.locator('tbody tr').first();
    await expect(first).toContainText('Gemini');
    await expect(first).toContainText('البيانات الصحية والطبية');
    await expect(first).toContainText('ألغى الإرسال');
  });

  test('the department dashboard counts it as well (counters written with the event)', async ({ request }) => {
    const da = await tokenOf(request, accounts.engAdmin);
    const read = async () => (await (await request.get('/api/dashboard/department/summary', { headers: bearer(da) })).json()).totals.total_events;
    const before = await read();
    const ext = await extensionToken(request, accounts.engUser);
    await request.post('/api/logs', { headers: bearer(ext), data: event({ platform: 'CLAUDE', risk_level: 'NONE', action: 'ALLOWED', categories: [], user_decision: 'NONE' }) });
    expect(await read()).toBe(before + 1);
  });

  test('anything beyond the allowed metadata is refused and nothing is stored', async ({ request }) => {
    const ext = await extensionToken(request, accounts.engUser);
    const web = await tokenOf(request, accounts.engUser);
    const total = async () => (await (await request.get('/api/dashboard/mine/summary', { headers: bearer(web) })).json()).totals.total_events as number;
    const before = await total();
    for (const extra of [{ prompt_text: 'my salary is 12000' }, { prompt: 'x' }, { user_id: randomUUID() }, { department_id: randomUUID() }, { raw: 'x' }]) {
      const res = await request.post('/api/logs', { headers: bearer(ext), data: { ...event(), ...extra } });
      expect(res.status(), JSON.stringify(Object.keys(extra))).toBe(400);
    }
    // Unknown enum values and a time far in the past are refused too.
    expect((await request.post('/api/logs', { headers: bearer(ext), data: event({ platform: 'COPILOT' }) })).status()).toBe(400);
    expect((await request.post('/api/logs', { headers: bearer(ext), data: event({ event_time: '2020-01-01T00:00:00.000Z' }) })).status()).toBe(400);
    expect(await total(), 'a refused event must not be counted or stored').toBe(before);
  });

  test('a web session cannot post events, and an extension token cannot open the admin API', async ({ request }) => {
    const web = await tokenOf(request, accounts.engUser);
    // A token is bound to the client it was issued for (audience): the wrong one is refused outright.
    expect((await request.post('/api/logs', { headers: bearer(web), data: event() })).status()).toBe(401);
    const ext = await extensionToken(request, accounts.admin);
    expect((await request.get('/api/admin/users', { headers: bearer(ext) })).status()).toBe(401);
  });

  test('events cannot be filed for someone else: the identity comes from the token', async ({ request }) => {
    const ext = await extensionToken(request, accounts.financeUser);
    const e = event();
    expect((await request.post('/api/logs', { headers: bearer(ext), data: e })).status()).toBe(201);
    const admin = await tokenOf(request, accounts.admin);
    const found = await (await request.get('/api/admin/logs?page_size=5', { headers: bearer(admin) })).json();
    const mine = found.items.find((l: { log_id: string }) => l.log_id === e.log_id);
    expect(mine).toMatchObject({ department_name: 'E2E Finance' });
  });
});
