import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/prisma/generated/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy api/.env.example to api/.env and set DATABASE_URL before running the seed.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const PASSWORD_MIN_LENGTH = 8;

const DATA_CATEGORIES: Prisma.DataCategoryCreateManyInput[] = [
  { categoryCode: 'CONTACT_INFO', name: 'Contact Information', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'PERSONAL_IDENTITY', name: 'Personal Identity Data', defaultRiskLevel: 'HIGH' },
  { categoryCode: 'FINANCIAL_BANKING', name: 'Financial & Banking Data', defaultRiskLevel: 'HIGH' },
  { categoryCode: 'AUTH_SECRETS', name: 'Authentication & Security Secrets', defaultRiskLevel: 'HIGH' },
  { categoryCode: 'NETWORK_SYSTEM', name: 'Network & System Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'WEB_LINKS', name: 'Web Links & Identifiers', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'LOCATION', name: 'Location Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'HEALTH_MEDICAL', name: 'Health / Medical Data', defaultRiskLevel: 'HIGH' },
  { categoryCode: 'LEGAL_GOVERNMENT', name: 'Legal & Government Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'VEHICLE', name: 'Vehicle Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'CORPORATE_DOCUMENTS', name: 'Corporate & Document Identifiers', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'FILE_PATH', name: 'File & Path Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'DIGITAL_FINGERPRINTS', name: 'Digital Fingerprints & Technical Identifiers', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'SHIPPING_LOGISTICS', name: 'Shipping & Logistics Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'CRYPTO_CERTIFICATES', name: 'Cryptography & Certificates', defaultRiskLevel: 'HIGH' },
  { categoryCode: 'ACCOUNT_APPLICATION', name: 'Account & Application Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'DATES_TIME', name: 'Dates & Time Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'KEYWORD_PATTERNS', name: 'Keyword-Based Sensitive Patterns', defaultRiskLevel: 'LOW' },
  { categoryCode: 'LOGS_HEADERS', name: 'Logs & Headers Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'NUMERIC_SENSITIVE', name: 'Numeric Sensitive Data', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'DEVELOPER_SECRETS', name: 'Developer & Code Secrets', defaultRiskLevel: 'HIGH' },
  { categoryCode: 'EDUCATION_IDS', name: 'Education-Related Identifiers', defaultRiskLevel: 'MEDIUM' },
  { categoryCode: 'UNIVERSAL_IDS', name: 'Universal Identifiers', defaultRiskLevel: 'LOW' },
  { categoryCode: 'REGION_BANKING_IDENTITY', name: 'Region-Specific Sensitive Banking & Identity Data', defaultRiskLevel: 'HIGH' },
];

function validatePassword(pw: string): void {
  const missing: string[] = [];
  if (pw.length < PASSWORD_MIN_LENGTH) missing.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Z]/.test(pw)) missing.push('an uppercase letter');
  if (!/[a-z]/.test(pw)) missing.push('a lowercase letter');
  if (!/\d/.test(pw)) missing.push('a digit');
  if (!/[^A-Za-z0-9]/.test(pw)) missing.push('a symbol');
  if (Buffer.byteLength(pw, 'utf8') > 72) missing.push('at most 72 bytes (bcrypt limit)');
  if (missing.length > 0) {
    throw new Error(
      `INITIAL_ADMIN_PASSWORD does not meet the password policy: missing ${missing.join(', ')}.`,
    );
  }
}

function getBootstrapAdminConfig(): { name: string; email: string; password: string } {
  const name = process.env.INITIAL_ADMIN_NAME;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('Missing INITIAL_ADMIN_NAME / INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD config.');
  }

  // Validate before touching the database so a bad config fails fast and
  // prints only the clear message.
  validatePassword(password);

  return { name, email, password };
}

async function seedBootstrapAdmin(cfg: { name: string; email: string; password: string }): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(cfg.password, 12);

  await prisma.user.create({
    data: {
      id: randomUUID(),
      fullName: cfg.name,
      email: cfg.email.toLowerCase(),
      passwordHash,
      role: 'SYSTEM_ADMIN',
      status: 'ACTIVE',
      departmentId: null,
      tokenVersion: 0,
      registeredAt: new Date(),
      approvedAt: new Date(),
    },
  });

  console.log(`Bootstrap SYSTEM_ADMIN created for ${cfg.email}.`);
}

async function main(): Promise<void> {
  const admin = getBootstrapAdminConfig();

  await prisma.dataCategory.createMany({
    data: DATA_CATEGORIES,
    skipDuplicates: true,
  });

  await prisma.policyVersion.upsert({
    where: { id: 1 },
    create: { id: 1, version: 1 },
    update: {},
  });

  await seedBootstrapAdmin(admin);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : 'Seed failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
