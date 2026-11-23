#!/usr/bin/env node
// Response-time measurement of the endpoints the browser extension calls (GP2 report, P4).
//
//   HARES_PERF_PASSWORD='...' node scripts/perf/measure-api.mjs --base http://localhost:3000 --email engineering.user1@example.test
//   options: --n 50 (requests per endpoint)  --out docs/gp2-evidence/perf/api-local.json  --label "local run"
//
// The password is read from the environment only (never from an argument, never printed or written to a file).
// Use a demo account on a demo database. It sends real requests: login, policy fetch, event upload and token refresh.
// Rate limits of the API are respected (login: 20 per minute, other routes 300 per minute, event upload 120 per minute
// per user), so the run takes a few minutes. Times are measured with the high-resolution clock around fetch(),
// from sending the request to the end of the response body, so they include the network.

import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import os from 'node:os';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.base ?? 'http://localhost:3000').replace(/\/+$/, '');
const email = args.email;
const password = process.env.HARES_PERF_PASSWORD;
const n = Number(args.n ?? 50);
if (!email || !password) {
  console.error('Need --email and the HARES_PERF_PASSWORD environment variable.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (path) => `${base}${path.startsWith('/api') ? path : `/api${path}`}`;

let connectionResets = 0;

/**
 * Time one request. A dropped connection (ECONNRESET: the server closed an idle keep-alive socket) is counted and
 * the request is sent again on a new connection, up to `attempts` times; only the successful attempt is timed.
 * After the last attempt the sample is recorded as failed (status 0). Never throws.
 */
async function timed(fn, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const t0 = performance.now();
    try {
      const res = await fn();
      const text = await res.text();
      return { ms: performance.now() - t0, status: res.status, text };
    } catch (e) {
      connectionResets++;
      if (i === attempts) return { ms: performance.now() - t0, status: 0, text: String(e?.cause?.code ?? e?.message ?? e) };
      await sleep(500);
    }
  }
}

function stats(samples) {
  const ok = samples.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  const at = (p) => (ok.length === 0 ? null : ok[Math.min(ok.length - 1, Math.ceil((p / 100) * ok.length) - 1)]);
  const r = (x) => (x === null ? null : Math.round(x * 10) / 10);
  return {
    requests: samples.length,
    succeeded: ok.length,
    failed: samples.length - ok.length,
    statuses: Object.fromEntries([...new Set(samples.map((s) => s.status))].map((st) => [st, samples.filter((s) => s.status === st).length])),
    median_ms: r(at(50)),
    p95_ms: r(at(95)),
    max_ms: r(ok.length ? ok[ok.length - 1] : null),
    min_ms: r(ok.length ? ok[0] : null),
  };
}

const json = { 'Content-Type': 'application/json' };
const results = {};

async function login() {
  return timed(() => fetch(api('/extension/login'), { method: 'POST', headers: json, body: JSON.stringify({ email, password }) }));
}

// 1. Login: 20 per minute at most, so one request every 3.2 seconds.
{
  const samples = [];
  let session;
  for (let i = 0; i < n; i++) {
    const r = await login();
    samples.push({ ms: r.ms, status: r.status, ok: r.status === 200 });
    if (r.status === 200) session = JSON.parse(r.text);
    else console.error(`login ${i + 1}: status ${r.status} ${r.status === 0 ? r.text : ''}`);
    if (i < n - 1) await sleep(3200);
  }
  results['login'] = stats(samples);
  if (!session) {
    console.error('Login never succeeded; stopping.');
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }
  globalThis.session = session;
}

let { access_token: access, refresh_token: refresh } = globalThis.session;

// 2. Policy fetch: the full bundle (no ETag), and the 304 answer (ETag from the first fetch).
{
  const full = [];
  let etag;
  for (let i = 0; i < n; i++) {
    const r = await timed(() => fetch(api('/policy/bundle'), { headers: { Authorization: `Bearer ${access}` } }));
    full.push({ ms: r.ms, status: r.status, ok: r.status === 200 });
    if (!etag) {
      const probe = await fetch(api('/policy/bundle'), { headers: { Authorization: `Bearer ${access}` } }).catch(() => null);
      etag = probe?.headers.get('etag') ?? undefined;
      await probe?.text();
    }
    await sleep(250);
  }
  results['policy_fetch_200'] = stats(full);
  if (!etag) {
    console.error('No ETag received; the 304 measurement is skipped.');
  }
  const notModified = [];
  for (let i = 0; etag && i < n; i++) {
    const r = await timed(() => fetch(api('/policy/bundle'), { headers: { Authorization: `Bearer ${access}`, 'If-None-Match': etag } }));
    notModified.push({ ms: r.ms, status: r.status, ok: r.status === 304 });
    await sleep(250);
  }
  results['policy_fetch_304'] = stats(notModified);
}

// 3. Event upload: a new log_id each time, metadata only, at most 120 per minute.
{
  const samples = [];
  for (let i = 0; i < n; i++) {
    const event = {
      log_id: randomUUID(),
      event_time: new Date().toISOString(),
      platform: 'CHATGPT',
      risk_level: 'NONE',
      action: 'ALLOWED',
      categories: [],
      classification_source: 'LOCAL',
      user_decision: 'NONE',
      schema_version: 1,
    };
    const r = await timed(() => fetch(api('/logs'), { method: 'POST', headers: { ...json, Authorization: `Bearer ${access}` }, body: JSON.stringify(event) }));
    samples.push({ ms: r.ms, status: r.status, ok: r.status === 201 || r.status === 200 }); // 200 = the same log_id sent again after a dropped connection
    await sleep(600);
  }
  results['event_upload'] = stats(samples);
}

// 4. Token refresh: each call rotates the token, so the next call uses the new one.
{
  let refreshRelogins = 0;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const r = await timed(() => fetch(api('/extension/refresh'), { method: 'POST', headers: json, body: JSON.stringify({ refresh_token: refresh }) }));
    samples.push({ ms: r.ms, status: r.status, ok: r.status === 200 });
    if (r.status === 200) {
      const body = JSON.parse(r.text);
      refresh = body.refresh_token;
      access = body.access_token;
    } else {
      // A refresh that failed may or may not have rotated the token on the server: sign in again to continue (not timed).
      refreshRelogins++;
      await sleep(3200);
      const again = await login();
      if (again.status === 200) ({ access_token: access, refresh_token: refresh } = JSON.parse(again.text));
    }
    await sleep(250);
  }
  results['refresh'] = { ...stats(samples), relogins_after_failure: refreshRelogins };
}

const report = {
  label: args.label ?? '',
  base,
  date: new Date().toISOString(),
  requests_per_endpoint: n,
  connection_resets_retried: connectionResets,
  machine: { os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, memory_gb: Math.round(os.totalmem() / 2 ** 30), node: process.version },
  results,
};
if (args.out) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
