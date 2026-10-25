import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { CATEGORY_CODES, type CategoryCode, type LogEvent } from '@hares/contract';
import type { PrismaClient } from '../prisma/generated/client';
import type { AuthUser } from '../common/auth-user';
import { IngestionService } from '../ingestion/ingestion.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Development-only synthetic data (B11). It writes departments, users and
 * activity-log METADATA (no prompt text exists anywhere in the schema) so the
 * dashboards and charts have something to show.
 *
 * Logs go through the same IngestionService.ingest() the extension uses, so the
 * EventCounter / CategoryCounter rows are written in the same transactions and
 * always match the logs.
 *
 * Re-running is safe: users are found by email, and every log_id is derived
 * from (seed, user, day, index), so a second run inserts nothing new.
 */

export const DEV_PASSWORD = 'Demo#Pass123';

export interface DevSeedOptions {
  /** Email domain for all synthetic users (RFC 2606 reserved, never a real mailbox). */
  domain?: string;
  /** Prefix for department names. */
  namePrefix?: string;
  usersPerDepartment?: number;
  daysBack?: number;
  /** Average events per user per day. */
  eventsPerUserPerDay?: number;
  /** Create the demo System Admin (tests turn it off: other suites count admins in the shared test database). */
  withSystemAdmin?: boolean;
  /** Fixed seed so two runs produce the same data. */
  seed?: number;
  now?: Date;
}

export interface DevSeedResult {
  departments: number;
  users: number;
  logsCreated: number;
  logsSkipped: number;
  accounts: { role: string; email: string }[];
}

const DEPARTMENTS = ['Engineering', 'Finance', 'Human Resources', 'Customer Support', 'Legal'];

/** Fictional names, enough variety for tables and charts. */
const FIRST = ['Layla', 'Omar', 'Noura', 'Khalid', 'Sara', 'Faisal', 'Maha', 'Yusuf', 'Reem', 'Saad', 'Huda', 'Talal'];
const LAST = ['Alharbi', 'Alotaibi', 'Alqahtani', 'Alshehri', 'Aldosari', 'Almutairi', 'Alzahrani', 'Alghamdi'];

/** Categories whose default risk is HIGH / LOW (copied from prisma/seed.ts). */
const HIGH: CategoryCode[] = [
  'PERSONAL_IDENTITY',
  'FINANCIAL_BANKING',
  'AUTH_SECRETS',
  'HEALTH_MEDICAL',
  'CRYPTO_CERTIFICATES',
  'DEVELOPER_SECRETS',
  'REGION_BANKING_IDENTITY',
];
const LOW: CategoryCode[] = ['KEYWORD_PATTERNS', 'UNIVERSAL_IDS'];
/** What people really paste most often. */
const FAVOURITES: CategoryCode[] = ['CONTACT_INFO', 'PERSONAL_IDENTITY', 'FINANCIAL_BANKING', 'AUTH_SECRETS', 'DEVELOPER_SECRETS', 'NETWORK_SYSTEM'];

type Risk = LogEvent['risk_level'];
type Action = LogEvent['action'];
type Decision = LogEvent['user_decision'];

/** Small deterministic PRNG (mulberry32): same seed, same data. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UUID-shaped id derived from a string, so re-runs produce the same ids. */
function stableUuid(input: string): string {
  const h = createHash('sha256').update(input).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function pick<T>(r: () => number, items: readonly T[]): T {
  return items[Math.floor(r() * items.length)]!;
}

function weighted<T>(r: () => number, items: readonly [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x < 0) return v;
  }
  return items[items.length - 1]![0];
}

/** One plausible event: risk follows the categories, the decision follows the action. */
export function makeEvent(r: () => number, logId: string, eventTime: Date): LogEvent {
  const categories: CategoryCode[] = [];
  if (r() < 0.72) {
    const n = weighted(r, [[1, 55], [2, 30], [3, 15]]);
    while (categories.length < n) {
      const c = r() < 0.6 ? pick(r, FAVOURITES) : pick(r, CATEGORY_CODES);
      if (!categories.includes(c)) categories.push(c);
    }
    categories.sort();
  }
  const risk: Risk =
    categories.length === 0
      ? 'NONE'
      : categories.some((c) => HIGH.includes(c))
        ? 'HIGH'
        : categories.every((c) => LOW.includes(c))
          ? 'LOW'
          : 'MEDIUM';
  const action: Action =
    risk === 'HIGH'
      ? weighted<Action>(r, [['BLOCKED', 55], ['WARNED', 40], ['ALLOWED', 5]])
      : risk === 'MEDIUM'
        ? weighted<Action>(r, [['WARNED', 60], ['BLOCKED', 15], ['ALLOWED', 25]])
        : risk === 'LOW'
          ? weighted<Action>(r, [['ALLOWED', 70], ['WARNED', 30]])
          : 'ALLOWED';
  const decision: Decision =
    action === 'ALLOWED'
      ? 'NONE'
      : action === 'BLOCKED'
        ? weighted<Decision>(r, [['CANCELLED', 40], ['EDITED', 30], ['REVISION_USED', 20], ['NONE', 10]])
        : weighted<Decision>(r, [['SUBMITTED_ANYWAY', 45], ['EDITED', 30], ['CANCELLED', 15], ['REVISION_USED', 10]]);
  return {
    log_id: logId,
    event_time: eventTime.toISOString(),
    platform: weighted<LogEvent['platform']>(r, [['CHATGPT', 60], ['GEMINI', 22], ['CLAUDE', 18]]),
    risk_level: risk,
    action,
    categories,
    classification_source: weighted<LogEvent['classification_source']>(r, [['LOCAL', 70], ['LOCAL_AI', 25], ['LOCAL_ONLY_FALLBACK', 5]]),
    user_decision: decision,
    schema_version: 1,
  };
}

export async function seedDevData(prisma: PrismaClient, opts: DevSeedOptions = {}): Promise<DevSeedResult> {
  const domain = opts.domain ?? 'example.test';
  const prefix = opts.namePrefix ?? 'Demo ';
  const usersPer = opts.usersPerDepartment ?? 6;
  const daysBack = Math.min(opts.daysBack ?? 45, 85);
  const perDay = opts.eventsPerUserPerDay ?? 3;
  const seed = opts.seed ?? 20261115;
  const now = opts.now ?? new Date();
  const ingestion = new IngestionService(prisma as unknown as PrismaService);
  const hash = await bcrypt.hash(DEV_PASSWORD, 12);
  const accounts: DevSeedResult['accounts'] = [];

  const ensureUser = async (
    email: string,
    fullName: string,
    role: 'SYSTEM_ADMIN' | 'DEPARTMENT_ADMIN' | 'USER',
    departmentId: string | null,
  ) => {
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (existing) return existing;
    return prisma.user.create({
      data: {
        id: stableUuid(`user:${email}`),
        fullName,
        email,
        passwordHash: hash,
        role,
        departmentId,
        status: 'ACTIVE',
        registeredAt: now,
        approvedAt: now,
      },
    });
  };

  let userCount = 0;
  if (opts.withSystemAdmin ?? true) {
    const sysadmin = await ensureUser(`admin.demo@${domain}`, 'Demo System Admin', 'SYSTEM_ADMIN', null);
    accounts.push({ role: 'SYSTEM_ADMIN', email: sysadmin.email });
    userCount++;
  }
  let created = 0;
  let skipped = 0;
  const dayMs = 86_400_000;

  for (const [di, dname] of DEPARTMENTS.entries()) {
    const name = `${prefix}${dname}`;
    const dept =
      (await prisma.department.findFirst({ where: { name } })) ??
      (await prisma.department.create({ data: { id: stableUuid(`dept:${name}`), name, active: true } }));
    const slug = dname.toLowerCase().replace(/[^a-z]+/g, '-');

    for (let ui = 0; ui < usersPer; ui++) {
      const isAdmin = ui === 0;
      const email = isAdmin ? `${slug}.admin@${domain}` : `${slug}.user${ui}@${domain}`;
      const fullName = `${FIRST[(di * 3 + ui) % FIRST.length]} ${LAST[(di + ui * 2) % LAST.length]}`;
      const u = await ensureUser(email, fullName, isAdmin ? 'DEPARTMENT_ADMIN' : 'USER', dept.id);
      userCount++;
      if (ui <= 1) accounts.push({ role: isAdmin ? 'DEPARTMENT_ADMIN' : 'USER', email });

      const authUser = { id: u.id, departmentId: dept.id } as unknown as AuthUser;
      const r = rng(seed + di * 1000 + ui);
      // Each user has their own habit: some paste sensitive data far more often.
      const habit = 0.4 + r() * 1.6;
      for (let d = daysBack; d >= 0; d--) {
        const day = new Date(now.getTime() - d * dayMs);
        // Quieter on Friday and Saturday (the weekend in Saudi Arabia).
        const dow = day.getUTCDay();
        const weekend = dow === 5 || dow === 6;
        const count = Math.round(perDay * habit * (weekend ? 0.25 : 1) * (0.6 + r() * 0.8));
        for (let k = 0; k < count; k++) {
          const t = new Date(
            Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 5 + Math.floor(r() * 13), Math.floor(r() * 60), Math.floor(r() * 60)),
          );
          if (t.getTime() > now.getTime() - 60_000) continue;
          const ev = makeEvent(r, stableUuid(`log:${seed}:${u.id}:${d}:${k}`), t);
          const res = await ingestion.ingest(authUser, ev, now);
          if (res.created) created++;
          else skipped++;
        }
      }
    }
  }

  return { departments: DEPARTMENTS.length, users: userCount, logsCreated: created, logsSkipped: skipped, accounts };
}
