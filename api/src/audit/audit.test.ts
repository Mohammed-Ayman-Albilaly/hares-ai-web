import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Fixtures, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';
import { AuditService } from './audit.service';

// Audit write helper (B4d). Runs in the per-run test database (global-setup),
// so append-only rows never pollute the dev database. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[audit] database not configured — skipping.');

describe.skipIf(!dbEnabled)('AuditService (append-only, same transaction)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let audit: AuditService;
  let prisma: PrismaService;
  let adminId: string;

  beforeAll(async () => {
    fx = new Fixtures();
    adminId = (await fx.user('audit-admin', { role: 'SYSTEM_ADMIN' })).id;
    t = await bootTestApp();
    audit = t.app.get(AuditService);
    prisma = t.app.get(PrismaService);
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  const count = async (targetId: string) =>
    (await fx.owner.query('SELECT count(*)::int AS n FROM "AdminAuditLog" WHERE target_id = $1', [targetId])).rows[0].n;

  it('commits the change and its audit entry together', async () => {
    const deptId = randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.department.create({ data: { id: deptId, name: `Audit ${deptId.slice(0, 8)}` } });
      await audit.recordIn(tx, {
        acting_admin_id: adminId,
        action: 'DEPARTMENT_CREATED',
        target_type: 'DEPARTMENT',
        target_id: deptId,
        detail: { name: 'Audit dept' },
      });
    });
    const { rows } = await fx.owner.query(
      'SELECT acting_admin_id, action_type, target_type, detail, created_at FROM "AdminAuditLog" WHERE target_id = $1',
      [deptId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      acting_admin_id: adminId,
      action_type: 'DEPARTMENT_CREATED',
      target_type: 'DEPARTMENT',
      detail: { name: 'Audit dept' },
    });
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it('rolls back the audit entry when the change fails', async () => {
    const deptId = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.department.create({ data: { id: deptId, name: `Rollback ${deptId.slice(0, 8)}` } });
        await audit.recordIn(tx, {
          acting_admin_id: adminId,
          action: 'DEPARTMENT_CREATED',
          target_type: 'DEPARTMENT',
          target_id: deptId,
        });
        throw new Error('simulated failure after the audit write');
      }),
    ).rejects.toThrow('simulated failure');
    expect(await count(deptId)).toBe(0);
    expect((await fx.owner.query('SELECT 1 FROM "Department" WHERE id = $1', [deptId])).rowCount).toBe(0);
  });

  it('allows a POLICY entry without a target id, but no other target without one', async () => {
    await audit.record({ acting_admin_id: adminId, action: 'POLICY_CHANGED', target_type: 'POLICY', target_id: null });
    await expect(
      audit.record({ acting_admin_id: adminId, action: 'USER_APPROVED', target_type: 'USER', target_id: null }),
    ).rejects.toThrow();
  });

  it('refuses sensitive detail keys and unknown actions', async () => {
    await expect(
      audit.record({
        acting_admin_id: adminId,
        action: 'RULE_CHANGED',
        target_type: 'CUSTOM_RULE',
        target_id: randomUUID(),
        detail: { definition: 'x' },
      }),
    ).rejects.toThrow(/not allowed/);
    await expect(
      audit.record({
        acting_admin_id: adminId,
        action: 'RULE_CHANGED',
        target_type: 'CUSTOM_RULE',
        target_id: randomUUID(),
        detail: { api_key: 'x' },
      }),
    ).rejects.toThrow(/not allowed/);
    await expect(
      audit.record({
        acting_admin_id: adminId,
        action: 'NOT_AN_ACTION' as never,
        target_type: 'USER',
        target_id: adminId,
      }),
    ).rejects.toThrow();
  });

  it('has no update/delete path: the app role and the owner are both refused', async () => {
    const target = randomUUID();
    await audit.record({ acting_admin_id: adminId, action: 'USER_APPROVED', target_type: 'USER', target_id: target });

    // App role (hares_app): privileges revoked.
    await expect(
      prisma.$executeRaw`UPDATE "AdminAuditLog" SET detail = '{}'::jsonb WHERE target_id = ${target}::uuid`,
    ).rejects.toThrow();
    await expect(prisma.$executeRaw`DELETE FROM "AdminAuditLog" WHERE target_id = ${target}::uuid`).rejects.toThrow();

    // Owner role: the append-only triggers still refuse.
    await expect(
      fx.owner.query(`UPDATE "AdminAuditLog" SET detail = '{}'::jsonb WHERE target_id = $1`, [target]),
    ).rejects.toThrow(/append-only/);
    await expect(fx.owner.query('DELETE FROM "AdminAuditLog" WHERE target_id = $1', [target])).rejects.toThrow(
      /append-only/,
    );
    expect(await count(target)).toBe(1);
  });

  it('rejects a missing target for non-POLICY entries before reaching the database', async () => {
    await expect(
      audit.record({ acting_admin_id: adminId, action: 'USER_REJECTED', target_type: 'USER', target_id: null }),
    ).rejects.toThrow(/audit.target_required/);
  });

  it('AuditService exposes only write methods', () => {
    const methods = Object.getOwnPropertyNames(AuditService.prototype).filter((m) => m !== 'constructor');
    expect(methods.sort()).toEqual(['record', 'recordIn']);
  });
});
