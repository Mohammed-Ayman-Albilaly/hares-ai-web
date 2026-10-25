import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/prisma/generated/client';
import { DEV_PASSWORD, seedDevData } from '../src/dev-seed/dev-seed';

// Development only. Writes SYNTHETIC departments, users and log metadata.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the dev seed with NODE_ENV=production.');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set (copy api/.env.example to api/.env).');
  process.exit(1);
}
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  console.error(`Refusing to seed demo data into a non-local database (${host}).`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

seedDevData(prisma)
  .then((r) => {
    console.log(`Departments: ${r.departments}, users: ${r.users}, logs created: ${r.logsCreated}, already present: ${r.logsSkipped}`);
    console.log(`Demo accounts (password ${DEV_PASSWORD}):`);
    for (const a of r.accounts) console.log(`  ${a.role.padEnd(16)} ${a.email}`);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : 'Dev seed failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
