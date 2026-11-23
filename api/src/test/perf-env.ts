import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { DEV_PASSWORD, seedDevData } from '../dev-seed/dev-seed';
import setup from './global-setup';

/**
 * Database for the local performance run (scripts/perf/run-local.ts, GP2 report P4): the same throwaway
 * `hares_test_*` database the test suites use, filled with the synthetic organisation `perf.test` (5 departments,
 * 6 people each, 45 days). `eventsPerUserPerDay` 7.5 gives about 10,000 activity-log rows.
 * The development database is never touched.
 */
export const PERF_DOMAIN = 'perf.test';
export const PERF_PASSWORD = DEV_PASSWORD;

export async function startPerfDatabase(eventsPerUserPerDay: number): Promise<{
  env: { DATABASE_URL: string; APP_DATABASE_URL: string };
  logs: number;
  users: number;
  stop: () => Promise<void>;
}> {
  loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') });
  const teardown = await setup();
  const url = process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;
  if (!url || !appUrl) throw new Error('No database is configured: set DATABASE_URL and APP_DATABASE_URL (api/.env).');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const r = await seedDevData(prisma, { domain: PERF_DOMAIN, namePrefix: 'Perf ', eventsPerUserPerDay, daysBack: 45 });
    return { env: { DATABASE_URL: url, APP_DATABASE_URL: appUrl }, logs: r.logsCreated, users: r.users, stop: async () => void (await teardown?.()) };
  } finally {
    await prisma.$disconnect();
  }
}
