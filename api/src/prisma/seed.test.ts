import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Tests for prisma/seed.ts.
//
// SAFETY: the seed runs against a throwaway database created fresh for this
// suite and dropped afterwards, so the developer database (DATABASE_URL) is
// never touched. Each scenario seeds from a clean slate.
// ---------------------------------------------------------------------------

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRISMA_CLI = path.join(API_DIR, 'node_modules', 'prisma', 'build', 'index.js');

/** Connection Prisma itself can reach (superuser `hares`, so it can create/drop DBs). */
const DEV_URL = process.env.DATABASE_URL;

// Decide at load time whether the suite can run: DATABASE_URL must be set and
// the server reachable (so we can create the throwaway DB). Mirror app-role.test.ts
// and skip the whole suite with a clear message instead of failing the run.
let dbReachable = false;
if (DEV_URL) {
  const probe = new Pool({ connectionString: DEV_URL, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('select 1');
    dbReachable = true;
  } catch {
    dbReachable = false;
  } finally {
    await probe.end().catch(() => {});
  }
}

const skipSuite = !DEV_URL || !dbReachable;
if (!DEV_URL) {
  console.warn('[seed] DATABASE_URL is not set — skipping the prisma/seed suite.');
} else if (!dbReachable) {
  console.warn('[seed] Cannot reach the database at DATABASE_URL — skipping the prisma/seed suite.');
}

const TEST_DB = `hares_seed_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const TEST_URL = DEV_URL
  ? (() => {
      const u = new URL(DEV_URL);
      u.pathname = `/${TEST_DB}`;
      return u.toString();
    })()
  : '';

let adminPool: Pool; // superuser connection to the temp DB (for counts / reset)
let controlPool: Pool; // superuser connection used only to CREATE / DROP the temp DB

/** Spawn the real seed script against the temp DB and return its outcome. */
function runSeed(extraEnv: Record<string, string>): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const res = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'prisma/seed.ts'],
    {
      cwd: API_DIR,
      env: {
        ...process.env,
        DATABASE_URL: TEST_URL,
        INITIAL_ADMIN_NAME: 'System Administrator',
        INITIAL_ADMIN_EMAIL: 'bootstrap@example.com',
        INITIAL_ADMIN_PASSWORD: 'ChangeMe!1234',
        ...extraEnv,
      },
      encoding: 'utf8',
    },
  );
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

async function counts(): Promise<{
  categories: number;
  policy_versions: number;
  total_users: number;
  active_sysadmin_no_dept: number;
}> {
  const r = await adminPool.query(
    `select
       (select count(*)::int from "DataCategory") as categories,
       (select count(*)::int from "PolicyVersion") as policy_versions,
       (select count(*)::int from "User") as total_users,
       (select count(*)::int from "User"
         where status = 'ACTIVE' and role = 'SYSTEM_ADMIN' and department_id is null)
         as active_sysadmin_no_dept`,
  );
  return r.rows[0];
}

/** Remove the seeded bootstrap admin so the rejection cases run from zero users. */
async function resetUsers(): Promise<void> {
  await adminPool.query(`delete from "User"`);
}

beforeAll(async () => {
  if (skipSuite) return;
  controlPool = new Pool({ connectionString: DEV_URL });
  await controlPool.query(`drop database if exists "${TEST_DB}"`);
  await controlPool.query(`create database "${TEST_DB}"`);

  const migrate = spawnSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: TEST_URL },
    encoding: 'utf8',
  });
  if (migrate.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed for ${TEST_DB}:\n${migrate.stdout}\n${migrate.stderr}`,
    );
  }

  adminPool = new Pool({ connectionString: TEST_URL });
});

afterAll(async () => {
  if (skipSuite) return;
  await adminPool?.end().catch(() => {});
  if (controlPool) {
    await controlPool
      .query(`drop database if exists "${TEST_DB}" with (force)`)
      .catch(() => {});
    await controlPool.end().catch(() => {});
  }
});

describe.skipIf(skipSuite)('prisma/seed.ts', () => {
  it('is idempotent: two runs leave 24 categories, 1 policy version and 1 active SYSTEM_ADMIN with no department', async () => {
    const first = runSeed({});
    expect(first.status).toBe(0);
    const second = runSeed({});
    expect(second.status).toBe(0);

    const c = await counts();
    expect(c.categories).toBe(24);
    expect(c.policy_versions).toBe(1);
    expect(c.total_users).toBe(1);
    expect(c.active_sysadmin_no_dept).toBe(1);
  });

  it('rejects a weak password, prints only the clear message and creates no user', async () => {
    await resetUsers();
    const run = runSeed({ INITIAL_ADMIN_PASSWORD: 'short1' });

    expect(run.status).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('INITIAL_ADMIN_PASSWORD does not meet the password policy');
    expect(run.stderr).not.toContain('undefined');
    await expectResetPreservesNoUser();
  });

  it('rejects a password longer than 72 bytes, prints only the clear message and creates no user', async () => {
    await resetUsers();
    const run = runSeed({ INITIAL_ADMIN_PASSWORD: 'A1@a' + 'b'.repeat(76) });

    expect(run.status).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('at most 72 bytes (bcrypt limit)');
    expect(run.stderr).not.toContain('undefined');
    await expectResetPreservesNoUser();
  });
});

async function expectResetPreservesNoUser(): Promise<void> {
  const c = await counts();
  expect(c.total_users).toBe(0);
}
