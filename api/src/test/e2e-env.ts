import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { seedDevData } from '../dev-seed/dev-seed';
import setup from './global-setup';

/**
 * Database for the browser end-to-end run (e2e/run.ts): the same throwaway
 * `hares_test_*` database the API test suites use (migrations, application role,
 * audit lock, seed) plus the synthetic demo organisation under the domain
 * `e2e.test`. The dev database is never touched. Returns the connection URLs for
 * the server process and a function that drops the database.
 */
export const E2E_DOMAIN = 'e2e.test';
export const E2E_PASSWORD = 'Demo#Pass123';

export async function startE2eDatabase(): Promise<{
  env: { DATABASE_URL: string; APP_DATABASE_URL: string };
  stop: () => Promise<void>;
}> {
  // The run starts from the repository root: read the API's own .env (database credentials) from there.
  loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') });
  const teardown = await setup();
  const url = process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;
  if (!url || !appUrl) throw new Error('No database is configured: set DATABASE_URL and APP_DATABASE_URL (api/.env).');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    // A small organisation: 5 departments, 3 people each, 3 weeks of activity.
    await seedDevData(prisma, { domain: E2E_DOMAIN, namePrefix: 'E2E ', usersPerDepartment: 3, daysBack: 21, eventsPerUserPerDay: 2 });
    // A TOPIC rule saved before decision 66 (enabled, no English description), so the rule lists show their
    // "not in effect" marker in the accessibility audit. The API no longer accepts such a rule, hence the direct write.
    const admin = await prisma.user.findFirstOrThrow({ where: { role: 'SYSTEM_ADMIN', email: { endsWith: `@${E2E_DOMAIN}` } } });
    await prisma.customRule.create({
      data: {
        id: randomUUID(),
        createdBy: admin.id,
        kind: 'TOPIC',
        name: 'E2E old topic rule',
        definition: 'old topic rule saved before decision 66',
        definitionEn: null,
        threshold: 0.3,
        riskLevel: 'MEDIUM',
        action: 'WARN',
        scope: 'ORG_WIDE',
        enabled: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
  return { env: { DATABASE_URL: url, APP_DATABASE_URL: appUrl }, stop: async () => void (await teardown?.()) };
}
