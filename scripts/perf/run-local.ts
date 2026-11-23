import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERF_DOMAIN, PERF_PASSWORD, startPerfDatabase } from '../../api/src/test/perf-env';

/**
 * Local performance run (GP2 report, P4). From the repository root:
 *
 *   pnpm --filter api build && pnpm --filter web build
 *   pnpm exec tsx scripts/perf/run-local.ts            (options: --events-per-user-per-day 7.5  --n 50  --runs 10)
 *
 * It creates a throwaway database (the same helper the test suites use: migrations, application role, audit lock),
 * fills it with synthetic demo data (about 10,000 activity-log rows with the default option), starts the BUNDLED API
 * (`api/dist/main.mjs`, what the production image runs) and the built web app, runs `measure-api.mjs` and
 * `measure-web.mjs` against them, writes the JSON results to `docs/gp2-evidence/perf/`, and drops everything.
 * The development database and the development servers are not used. The rate limits stay ON (the real configuration).
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_PORT = 3300;
const WEB_PORT = 1530;
const DOMAIN = PERF_DOMAIN;
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};

const children: ChildProcess[] = [];
function stopAll(): void {
  for (const c of children) if (c.pid) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
}
const run = (cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false, env });
    p.on('exit', (c) => resolve(c ?? 1));
  });
async function waitFor(url: string, ms = 90_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer within ${ms / 1000}s`);
}

async function main(): Promise<number> {
  const db = await startPerfDatabase(Number(arg('events-per-user-per-day', '7.5')));
  console.log(`[perf] seeded ${db.users} users and ${db.logs} activity-log rows`);
  let code = 1;
  try {
    const url = db.env.DATABASE_URL;
    const appUrl = db.env.APP_DATABASE_URL;

    const apiEnv = {
      ...process.env,
      DATABASE_URL: url,
      APP_DATABASE_URL: appUrl,
      PORT: String(API_PORT),
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
      WEB_BASE_URL: `http://localhost:${WEB_PORT}`,
      JOBS: 'off',
    };
    children.push(spawn(process.execPath, [path.join(ROOT, 'api', 'dist', 'main.mjs')], { cwd: path.join(ROOT, 'api'), env: apiEnv, stdio: 'ignore' }));
    const viteCli = path.join(ROOT, 'web', 'node_modules', 'vite', 'bin', 'vite.js');
    children.push(
      spawn(process.execPath, [viteCli, 'preview', '--port', String(WEB_PORT), '--strictPort', '--host', 'localhost'], {
        cwd: path.join(ROOT, 'web'),
        env: { ...process.env, API_URL: `http://localhost:${API_PORT}` },
        stdio: 'ignore',
      }),
    );
    await waitFor(`http://localhost:${API_PORT}/api/health`);
    await waitFor(`http://localhost:${WEB_PORT}`);

    const env = { ...process.env, HARES_PERF_PASSWORD: PERF_PASSWORD };
    const n = arg('n', '50');
    const runs = arg('runs', '10');
    code = await run(
      process.execPath,
      ['scripts/perf/measure-api.mjs', '--base', `http://localhost:${API_PORT}`, '--email', `engineering.user1@${DOMAIN}`, '--n', n, '--label', 'local run, bundled API, throwaway database', '--out', 'docs/gp2-evidence/perf/api-local.json'],
      env,
    );
    if (code === 0) {
      code = await run(
        process.execPath,
        ['scripts/perf/measure-web.mjs', '--base', `http://localhost:${WEB_PORT}`, '--email', `admin.demo@${DOMAIN}`, '--runs', runs, '--label', 'local run, built web app, bundled API, 10,000 log rows', '--out', 'docs/gp2-evidence/perf/web-local.json'],
        env,
      );
    }
  } finally {
    stopAll();
    await new Promise((r) => setTimeout(r, 1000));
    await db.stop().catch((e: unknown) => console.error('[perf] could not drop the database:', e));
  }
  return code;
}

main().then((c) => process.exit(c));
