#!/usr/bin/env node
// Dashboard and log-page timings in a real browser, and the CSV export (GP2 report, P4).
//
//   HARES_PERF_PASSWORD='...' node scripts/perf/measure-web.mjs --base http://localhost:1420 --email admin.demo@example.test
//   options: --runs 10  --out docs/gp2-evidence/perf/web-local.json  --label "local run"
//
// Needs Chromium (`pnpm e2e:browser-install`) and a System Admin demo account (the dashboard and log pages of that
// role). The password comes from the environment only. What is measured (Chromium, Arabic UI, desktop 1366x768):
//  - dashboard, cold: a fresh browser context (empty HTTP cache, signed in by the API call), time from the start of
//    the navigation to `/admin/dashboard` until a chart (role "img") is on screen and no loading skeleton is left;
//  - dashboard, warm: the same page visited a second time in the same context (assets cached);
//  - log page: time from navigation to the first table row on screen (cold and warm);
//  - log API: first page (default page size) and the CSV export of all rows, time to the last byte, rows and bytes.
// "Cold" here means an empty browser cache, not a sleeping server; the sleeping-server case is measured separately
// (first request to a service that has been idle, see the evidence file).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import os from 'node:os';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.base ?? 'http://localhost:1420').replace(/\/+$/, '');
const email = args.email;
const password = process.env.HARES_PERF_PASSWORD;
const runs = Number(args.runs ?? 10);
if (!email || !password) {
  console.error('Need --email and the HARES_PERF_PASSWORD environment variable.');
  process.exit(2);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? null : s[Math.floor((s.length - 1) / 2)];
};
const round = (x) => (x === null ? null : Math.round(x));
const summary = (xs) => ({ runs: xs.length, median_ms: round(median(xs)), max_ms: round(Math.max(...xs)), min_ms: round(Math.min(...xs)), all_ms: xs.map(round) });

const browser = await chromium.launch();

async function newSession() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'ar-SA' });
  const page = await context.newPage();
  const res = await page.request.post(`${base}/api/auth/login`, { data: { email, password }, headers: { Origin: base } });
  if (res.status() !== 200) throw new Error(`Sign-in failed with status ${res.status()}`);
  return { context, page, token: (await res.json()).access_token };
}

/** Navigate and wait until the screen shows what it is for; returns milliseconds. */
async function timedVisit(page, path, ready) {
  const t0 = performance.now();
  await page.goto(`${base}${path}`);
  await ready(page);
  return performance.now() - t0;
}
const chartsDrawn = async (page) => {
  await page.getByRole('img').first().waitFor({ state: 'visible' });
  await page.locator('.skeleton').first().waitFor({ state: 'detached' }).catch(() => undefined);
};
const firstRow = async (page) => {
  await page.locator('tbody tr').first().waitFor({ state: 'visible' });
};

const out = { dashboard_cold: [], dashboard_warm: [], logs_cold: [], logs_warm: [] };
for (let i = 0; i < runs; i++) {
  const s = await newSession();
  out.dashboard_cold.push(await timedVisit(s.page, '/admin/dashboard', chartsDrawn));
  out.dashboard_warm.push(await timedVisit(s.page, '/admin/dashboard', chartsDrawn));
  out.logs_cold.push(await timedVisit(s.page, '/admin/logs', firstRow));
  out.logs_warm.push(await timedVisit(s.page, '/admin/logs', firstRow));
  await s.context.close();
}

// API side of the log page, with one session.
const s = await newSession();
const auth = { Authorization: `Bearer ${s.token}`, Origin: base };
const firstPage = [];
for (let i = 0; i < runs; i++) {
  const t0 = performance.now();
  const r = await s.page.request.get(`${base}/api/admin/logs`, { headers: auth });
  await r.body();
  if (r.status() !== 200) throw new Error(`Log list answered ${r.status()}`);
  firstPage.push(performance.now() - t0);
}
const exportRuns = [];
let exportRows = 0;
let exportBytes = 0;
for (let i = 0; i < Math.min(runs, 5); i++) {
  const t0 = performance.now();
  const r = await s.page.request.get(`${base}/api/admin/logs/export`, { headers: auth, timeout: 300_000 });
  const body = await r.body();
  if (r.status() !== 200) throw new Error(`CSV export answered ${r.status()}`);
  exportRuns.push(performance.now() - t0);
  exportBytes = body.length;
  exportRows = body.toString('utf8').split('\r\n').filter(Boolean).length - 1; // minus the header
}
await s.context.close();
await browser.close();

const report = {
  label: args.label ?? '',
  base,
  date: new Date().toISOString(),
  machine: { os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, memory_gb: Math.round(os.totalmem() / 2 ** 30), node: process.version },
  browser: 'Chromium (Playwright), 1366x768, ar-SA',
  dashboard_cold: summary(out.dashboard_cold),
  dashboard_warm: summary(out.dashboard_warm),
  logs_page_cold: summary(out.logs_cold),
  logs_page_warm: summary(out.logs_warm),
  log_api_first_page: summary(firstPage),
  csv_export: { ...summary(exportRuns), rows: exportRows, bytes: exportBytes },
};
if (args.out) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
