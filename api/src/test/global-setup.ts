import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolConfig } from 'pg';

// ---------------------------------------------------------------------------
// Vitest global setup: every test run gets its own throwaway database.
//
// The dev database is never touched by the suites. This matters because the
// audit trail is append-only (triggers + REVOKE) and its FK to User is
// RESTRICT, so a test user that appears in AdminAuditLog could never be
// deleted from a shared database.
//
// Steps (same order as a deployment, docs/AGENT-RULES.md):
//   1. drop stale hares_test_* databases left by killed runs
//   2. CREATE DATABASE hares_test_<random> (as the owner role, DATABASE_URL)
//   3. prisma migrate deploy
//   4. api/db/roles.sql grants for the app role (the role itself is
//      cluster-wide; it is created from APP_DATABASE_URL if missing), then
//      ops/revoke-audit-privileges.sql
//   5. prisma db seed (24 categories, policy version, bootstrap admin)
// DATABASE_URL and APP_DATABASE_URL are then pointed at the test database for
// all workers (HARES_TEST_DB names it), and the database is dropped at the end.
//
// Fail closed: if the server is unreachable, both URLs are blanked so every DB
// suite skips; they can never fall back to the dev database.
// ---------------------------------------------------------------------------

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_DIR = path.resolve(API_DIR, '..');
const STEP_TIMEOUT_MS = 180_000;

function withDatabase(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

/**
 * A pg Pool for the suites. The server closes a session with "terminating
 * connection due to administrator command" (57P01) when its database is dropped
 * WITH (FORCE); pg surfaces that on an idle client as an `error` event on the
 * pool, which crashes the worker when nothing listens. Teardown is the only time
 * this can happen (see dropTestDatabase), so log it instead.
 */
export function testPool(config: PoolConfig): Pool {
  const pool = new Pool(config);
  pool.on('error', (e) => console.warn(`[test-db] idle connection closed by the server: ${e.message}`));
  return pool;
}

/**
 * Drop a throwaway database once nothing is connected to it.
 *
 * `Pool.end()` resolves when the Terminate messages are queued, not when the
 * server has closed the backends, and Vitest runs this teardown while the
 * workers are still alive. A DROP ... WITH (FORCE) issued straight after the
 * suites' `end()` calls therefore races the server: it can kill a backend that
 * is still shutting down, and the client receives 57P01 as an unhandled error.
 * Waiting for pg_stat_activity to drain (a few ms in practice) removes the
 * race; FORCE is kept only for sessions a killed worker never closed. This is
 * simpler than pg_terminate_backend, which would kill those same sessions and
 * produce the very error we are avoiding.
 */
export async function dropTestDatabase(control: Pool, db: string): Promise<void> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const open = await control.query(
      'SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid() LIMIT 1',
      [db],
    );
    if (open.rowCount === 0 || Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  await control.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
}

/**
 * Turn a psql script into plain SQL for one database: drop psql meta-commands
 * and the role-creation query (fed to \gexec), substitute the app role name.
 */
function psqlScriptToSql(file: string, appRole: string): string {
  const src = readFileSync(file, 'utf8');
  const withoutCreateRole = src.replace(/SELECT\s+CASE[\s\S]*?\\gexec/i, '');
  return withoutCreateRole
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('\\'))
    .join('\n')
    .replaceAll(':"app_role"', `"${appRole}"`)
    .replaceAll(":'app_role'", `'${appRole}'`);
}

function run(args: string[], env: NodeJS.ProcessEnv): void {
  const res = spawnSync(process.execPath, args, { cwd: API_DIR, env, encoding: 'utf8', timeout: STEP_TIMEOUT_MS });
  if (res.status !== 0) {
    throw new Error(`[test-db] ${path.basename(args[0])} ${args.slice(1).join(' ')} failed:\n${res.stdout}\n${res.stderr}`);
  }
}

function disableDbSuites(reason: string): void {
  console.warn(`[test-db] ${reason} — database suites will skip.`);
  process.env.DATABASE_URL = '';
  process.env.APP_DATABASE_URL = '';
}

export default async function setup(): Promise<(() => Promise<void>) | void> {
  const ownerUrl = process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;
  if (!ownerUrl || !appUrl) return disableDbSuites('DATABASE_URL / APP_DATABASE_URL not set');

  const control = testPool({ connectionString: ownerUrl, connectionTimeoutMillis: 5000 });
  try {
    await control.query('SELECT 1');
  } catch {
    await control.end().catch(() => {});
    return disableDbSuites('database server not reachable');
  }

  const db = `hares_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const app = new URL(appUrl);
  const appRole = decodeURIComponent(app.username);

  try {
    // 1. Stale databases from killed runs (no open sessions).
    const stale = await control.query<{ datname: string }>(
      `SELECT datname FROM pg_database d
        WHERE datname LIKE 'hares\\_test\\_%'
          AND NOT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE a.datname = d.datname)`,
    );
    for (const { datname } of stale.rows) await control.query(`DROP DATABASE IF EXISTS "${datname}"`);

    // The app role is cluster-wide: create it once if this machine never ran roles.sql.
    const role = await control.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appRole]);
    if (role.rowCount === 0) {
      const pw = decodeURIComponent(app.password).replaceAll("'", "''");
      await control.query(`CREATE ROLE "${appRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${pw}'`);
    }

    await control.query(`CREATE DATABASE "${db}"`);
  } catch (e) {
    await control.end().catch(() => {});
    throw e;
  }

  const testOwnerUrl = withDatabase(ownerUrl, db);
  const testAppUrl = withDatabase(appUrl, db);

  try {
    const env = { ...process.env, DATABASE_URL: testOwnerUrl };
    run([path.join(API_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], env);

    const owner = testPool({ connectionString: testOwnerUrl });
    try {
      await owner.query(psqlScriptToSql(path.join(API_DIR, 'db', 'roles.sql'), appRole));
      await owner.query(psqlScriptToSql(path.join(REPO_DIR, 'ops', 'revoke-audit-privileges.sql'), appRole));
    } finally {
      await owner.end();
    }

    run([path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'prisma/seed.ts'], {
      ...env,
      INITIAL_ADMIN_NAME: 'Test Bootstrap Admin',
      INITIAL_ADMIN_EMAIL: 'bootstrap-admin@synthetic.test',
      INITIAL_ADMIN_PASSWORD: 'Bootstrap#Pass1',
    });
  } catch (e) {
    try {
      await dropTestDatabase(control, db);
    } finally {
      await control.end().catch(() => {});
    }
    throw e;
  }

  // Workers are forked after this point and inherit these values.
  process.env.DATABASE_URL = testOwnerUrl;
  process.env.APP_DATABASE_URL = testAppUrl;
  process.env.HARES_TEST_DB = db;

  return async () => {
    try {
      await dropTestDatabase(control, db);
    } finally {
      await control.end().catch(() => {});
    }
  };
}
