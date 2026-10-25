import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LogEventSchema } from '@hares/contract';
import { PrismaClient } from '../prisma/generated/client';
import { dbEnabled, ownerUrl } from '../test/http-test-app';
import { makeEvent, rng, seedDevData } from './dev-seed';

// B11: synthetic data goes through the real ingestion service, so counters
// match the logs. Runs in the per-run test database. SYNTHETIC DATA ONLY.

describe('dev seed events', () => {
  it('every generated event passes the ingestion contract and is internally consistent', () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const e = makeEvent(r, randomUUID(), new Date());
      expect(LogEventSchema.safeParse(e).success).toBe(true);
      if (e.categories.length === 0) expect(e.risk_level).toBe('NONE');
      if (e.action === 'ALLOWED') expect(e.user_decision).toBe('NONE');
    }
  });

  it('is deterministic for a given seed', () => {
    const a = makeEvent(rng(1), 'x', new Date(0));
    const b = makeEvent(rng(1), 'x', new Date(0));
    expect(a).toEqual(b);
  });
});

describe.skipIf(!dbEnabled)('dev seed (B11)', () => {
  const salt = randomUUID().slice(0, 8);
  const domain = `seed-${salt}.test`;
  const prefix = `Seed ${salt} `;
  let prisma: PrismaClient;
  let owner: Pool;

  const opts = { domain, namePrefix: prefix, usersPerDepartment: 2, daysBack: 6, eventsPerUserPerDay: 3, seed: 99, withSystemAdmin: false };
  const sql = async (text: string, params: unknown[] = []) => (await owner.query(text, params)).rows;

  beforeAll(() => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: ownerUrl }) });
    owner = new Pool({ connectionString: ownerUrl });
  });

  afterAll(async () => {
    const depts = `SELECT id FROM "Department" WHERE name LIKE $1`;
    const like = `${prefix}%`;
    await owner.query(`DELETE FROM "ActivityLog" WHERE department_id IN (${depts})`, [like]);
    await owner.query(`DELETE FROM "EventCounter" WHERE department_id IN (${depts})`, [like]);
    await owner.query(`DELETE FROM "CategoryCounter" WHERE department_id IN (${depts})`, [like]);
    await owner.query(`DELETE FROM "User" WHERE email LIKE $1`, [`%@${domain}`]);
    await owner.query(`DELETE FROM "Department" WHERE name LIKE $1`, [like]);
    await owner.end();
    await prisma.$disconnect();
  });

  it('creates users and logs, and the counters equal the logs', async () => {
    const res = await seedDevData(prisma, opts);
    expect(res.logsCreated).toBeGreaterThan(0);
    expect(res.accounts.some((a) => a.role === 'DEPARTMENT_ADMIN')).toBe(true);

    const logs = Number((await sql(`SELECT count(*) c FROM "ActivityLog" WHERE department_id IN (SELECT id FROM "Department" WHERE name LIKE $1)`, [`${prefix}%`]))[0].c);
    const counted = Number((await sql(`SELECT coalesce(sum(event_count),0) c FROM "EventCounter" WHERE department_id IN (SELECT id FROM "Department" WHERE name LIKE $1)`, [`${prefix}%`]))[0].c);
    const links = Number((await sql(`SELECT count(*) c FROM "LogCategory" WHERE log_id IN (SELECT log_id FROM "ActivityLog" WHERE department_id IN (SELECT id FROM "Department" WHERE name LIKE $1))`, [`${prefix}%`]))[0].c);
    const catCounted = Number((await sql(`SELECT coalesce(sum(event_count),0) c FROM "CategoryCounter" WHERE department_id IN (SELECT id FROM "Department" WHERE name LIKE $1)`, [`${prefix}%`]))[0].c);
    expect(logs).toBe(res.logsCreated);
    expect(counted).toBe(logs);
    expect(catCounted).toBe(links);
  });

  it('running it again changes nothing (idempotent)', async () => {
    const before = Number((await sql(`SELECT count(*) c FROM "ActivityLog" WHERE department_id IN (SELECT id FROM "Department" WHERE name LIKE $1)`, [`${prefix}%`]))[0].c);
    const again = await seedDevData(prisma, opts);
    expect(again.logsCreated).toBe(0);
    expect(again.logsSkipped).toBe(before);
  });

  it('the ActivityLog table has no free-text column (metadata only)', async () => {
    const cols = (await sql(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ActivityLog'`)).filter(
      (c) => c.data_type === 'text' || c.data_type === 'character varying',
    );
    expect(cols).toEqual([]);
  });
});
