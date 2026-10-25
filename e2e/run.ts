import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startE2eDatabase } from '../api/src/test/e2e-env';

/**
 * Browser end-to-end run, from one command (`pnpm e2e`):
 *   1. a throwaway database with the demo organisation (api/src/test/e2e-env.ts)
 *   2. the real API process on :3200 and the built web app on :1520
 *      (vite preview, proxying /api to the API: one origin, as in production)
 *   3. Playwright against them
 *   4. everything stopped and the database dropped, whatever the result.
 * The dev database and the dev servers are never used.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = 3200;
const WEB_PORT = 1520;
const WEB_URL = `http://localhost:${WEB_PORT}`;

const children: ChildProcess[] = [];
const tails = new Map<string, string[]>();
let stopping = false;

function start(name: string, cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const tail: string[] = [];
  tails.set(name, tail);
  const keep = (b: Buffer) => {
    tail.push(...b.toString().split('\n').filter(Boolean));
    if (tail.length > 40) tail.splice(0, tail.length - 40);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.on('exit', (code) => {
    if (!stopping && code !== 0 && code !== null) console.error(`[e2e] ${name} exited with ${code}:\n${tail.join('\n')}`);
  });
  children.push(child);
  return child;
}

/** A port that already answers belongs to another run: using it would test the wrong database. */
function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error(`Port ${port} is already in use (a stale test server?). Stop it and run again.`));
    });
    socket.once('error', () => resolve());
  });
}

async function waitFor(url: string, what: string, ms = 90_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  // What the servers printed so far explains a failed start.
  const out = [...tails.entries()].map(([n, t]) => `--- ${n} output ---\n${t.slice(-15).join('\n')}`).join('\n');
  throw new Error(`${what} did not start within ${ms / 1000}s (${url})\n${out}`);
}

function stopAll(): void {
  stopping = true;
  for (const c of children) {
    if (c.pid && !c.killed) {
      // On Windows a plain kill leaves the node child of a shell behind: kill the tree.
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else c.kill('SIGTERM');
    }
  }
}

async function main(): Promise<number> {
  await assertPortFree(API_PORT);
  await assertPortFree(WEB_PORT);
  const db = await startE2eDatabase();
  let code = 1;
  try {
    const build = spawnSync('pnpm', ['--filter', 'web', 'build'], { cwd: ROOT, encoding: 'utf8', shell: true });
    if (build.status !== 0) throw new Error(`web build failed:
${build.stdout}
${build.stderr}`);

    const tsxCli = path.join(ROOT, 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs');
    start('api', process.execPath, [tsxCli, 'src/main.ts'], path.join(ROOT, 'api'), {
      ...process.env,
      ...db.env,
      PORT: String(API_PORT),
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      CORS_ORIGIN: WEB_URL,
      WEB_BASE_URL: WEB_URL,
      // The end-to-end run signs in dozens of times from one address; the progressive
      // failed-login throttle stays on (and has its own test), the per-endpoint windows do not.
      RATE_LIMITS: 'off',
      JOBS: 'off',
    });
    const viteCli = path.join(ROOT, 'web', 'node_modules', 'vite', 'bin', 'vite.js');
    start('web', process.execPath, [viteCli, 'preview', '--port', String(WEB_PORT), '--strictPort', '--host', 'localhost'], path.join(ROOT, 'web'), {
      ...process.env,
      API_URL: `http://localhost:${API_PORT}`,
    });
    await waitFor(`http://localhost:${API_PORT}/api/health`, 'API');
    await waitFor(WEB_URL, 'web app');

    const args = process.argv.slice(2);
    // Asynchronous on purpose: while this process waits, it must keep reading the servers' output.
    // A blocking wait (spawnSync) lets the pipe buffers fill up and the API stalls on its own request log.
    code = await new Promise<number>((resolve) => {
      const pw = spawn('pnpm', ['exec', 'playwright', 'test', ...args], {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, E2E_BASE_URL: WEB_URL, E2E_API_URL: `http://localhost:${API_PORT}` },
      });
      pw.on('exit', (c) => resolve(c ?? 1));
      pw.on('error', (e) => {
        console.error('[e2e] could not start Playwright:', e.message);
        resolve(1);
      });
    });
  } finally {
    stopAll();
    await new Promise((r) => setTimeout(r, 1000));
    await db.stop().catch((e) => console.error('[e2e] could not drop the database:', e));
  }
  return code;
}

// Ctrl+C and the termination signal of a CI cancel both stop the servers (the next run also sweeps old databases).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopAll();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    stopAll();
    process.exit(1);
  });
