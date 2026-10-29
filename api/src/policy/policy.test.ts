import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  CATEGORY_CODES,
  CustomRuleResponseSchema,
  DepartmentPolicyResponseSchema,
  OrgPolicyResponseSchema,
  PolicyBundleResponseSchema,
} from '@hares/contract';
import { TokenService } from '../auth/token.service';
import { Fixtures, TEST_PASSWORD, bootTestApp, dbEnabled, type TestApp } from '../test/http-test-app';
import { PolicyService } from './policy.service';

// Policy, custom rules and the versioned bundle (B6). Runs in the per-run test
// database. SYNTHETIC DATA ONLY.

if (!dbEnabled) console.warn('[policy] database not configured — skipping.');

describe.skipIf(!dbEnabled)('policy, rules and bundle (B6)', () => {
  let t: TestApp;
  let fx: Fixtures;
  let deptA: string;
  let deptB: string;
  let sa: { id: string };
  let da: { id: string };
  let saToken: string;
  let daToken: string;
  let userToken: string;
  let extA: string; // extension token of a user in deptA
  let extNoDept: string; // extension token of a System Admin (no department)

  const version = () => t.app.get(PolicyService).currentVersion();
  const bundle = (bearer: string, headers: Record<string, string> = {}) =>
    t.call('GET', '/api/policy/bundle', { bearer, headers });
  const audits = async (action: string) =>
    (await fx.owner.query('SELECT detail FROM "AdminAuditLog" WHERE action_type = $1 ORDER BY created_at', [action])).rows;
  const rule = (over: Record<string, unknown> = {}) => ({
    name: `Rule ${fx.salt}`,
    kind: 'KEYWORD',
    definition: 'alpha\nbeta',
    risk_level: 'MEDIUM',
    action: 'WARN',
    scope: 'ORG_WIDE',
    department_ids: [],
    enabled: true,
    ...over,
  });

  beforeAll(async () => {
    fx = new Fixtures();
    deptA = await fx.department('Pol A');
    deptB = await fx.department('Pol B');
    sa = await fx.user('p-sa', { role: 'SYSTEM_ADMIN' });
    da = await fx.user('p-da', { role: 'DEPARTMENT_ADMIN', departmentId: deptA });
    const plain = await fx.user('p-user', { role: 'USER', departmentId: deptA });
    t = await bootTestApp();
    const tokens = t.app.get(TokenService);
    saToken = await tokens.signAccess({ sub: sa.id, tv: 0 }, 'web');
    daToken = await tokens.signAccess({ sub: da.id, tv: 0 }, 'web');
    userToken = await tokens.signAccess({ sub: plain.id, tv: 0 }, 'web');
    extA = await tokens.signAccess({ sub: plain.id, tv: 0 }, 'extension');
    extNoDept = await tokens.signAccess({ sub: sa.id, tv: 0 }, 'extension');
  }, 60_000);

  afterAll(async () => {
    await t?.close();
    await fx?.owner.end();
  });

  // ---------- defaults and org policy ----------

  it('serves built-in defaults per risk level when nothing is configured', async () => {
    const res = await t.call('GET', '/api/admin/policy/org', { bearer: saToken });
    expect(res.status).toBe(200);
    expect(OrgPolicyResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.items.map((e: { category_code: string }) => e.category_code)).toEqual([...CATEGORY_CODES]);
    for (const e of res.body.items) {
      expect(e.source).toBe('DEFAULT');
      expect(e.enabled).toBe(true);
      const byRisk = { HIGH: 'BLOCK', MEDIUM: 'WARN', LOW: 'ALLOW', NONE: 'ALLOW' }[e.default_risk_level as string];
      // PERSONAL_IDENTITY also covers person names, so it warns by default instead of blocking.
      expect(e.action).toBe(e.category_code === 'PERSONAL_IDENTITY' ? 'WARN' : byRisk);
    }
  });

  it('sets an org value (bumps the version, audits old and new); an identical write bumps nothing', async () => {
    const v0 = await version();
    const res = await t.call('PUT', '/api/admin/policy/org/CONTACT_INFO', { bearer: saToken, body: { action: 'BLOCK', enabled: false } });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(v0 + 1);
    expect(res.body.items.find((e: { category_code: string }) => e.category_code === 'CONTACT_INFO')).toMatchObject({
      action: 'BLOCK',
      enabled: false,
      source: 'ORG',
    });
    const again = await t.call('PUT', '/api/admin/policy/org/CONTACT_INFO', { bearer: saToken, body: { action: 'BLOCK', enabled: false } });
    expect(again.body.version).toBe(v0 + 1);

    const changed = await t.call('PUT', '/api/admin/policy/org/CONTACT_INFO', { bearer: saToken, body: { action: 'WARN', enabled: true } });
    expect(changed.body.version).toBe(v0 + 2);
    const last = (await audits('POLICY_CHANGED')).at(-1)!.detail;
    expect(last).toMatchObject({ category_code: 'CONTACT_INFO', action: 'WARN', old_action: 'BLOCK', old_enabled: false, version: v0 + 2 });
  });

  it('concurrent first writes of the same category end with one row and no 500', async () => {
    const results = await Promise.all(
      ['ALLOW', 'WARN', 'BLOCK'].map((action) =>
        t.call('PUT', '/api/admin/policy/org/LOCATION', { bearer: saToken, body: { action, enabled: true } }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const { rows } = await fx.owner.query(`SELECT count(*)::int AS n FROM "PolicyCategoryAction" WHERE department_id IS NULL AND category_code = 'LOCATION'`);
    expect(rows[0].n).toBe(1);
  });

  it('validates category and body (400)', async () => {
    expect((await t.call('PUT', '/api/admin/policy/org/NOT_A_CATEGORY', { bearer: saToken, body: { action: 'BLOCK', enabled: true } })).status).toBe(400);
    expect((await t.call('PUT', '/api/admin/policy/org/VEHICLE', { bearer: saToken, body: { action: 'DROP', enabled: true } })).status).toBe(400);
    expect((await t.call('PUT', '/api/admin/policy/org/VEHICLE', { bearer: saToken, body: { action: 'BLOCK' } })).status).toBe(400);
  });

  // ---------- department overrides ----------

  it('a department override beats the org value; removing it falls back; Department Admin sees only their own', async () => {
    await t.call('PUT', '/api/admin/policy/org/HEALTH_MEDICAL', { bearer: saToken, body: { action: 'WARN', enabled: true } });
    const set = await t.call('PUT', `/api/admin/policy/departments/${deptA}/HEALTH_MEDICAL`, { bearer: saToken, body: { action: 'BLOCK', enabled: true } });
    expect(DepartmentPolicyResponseSchema.safeParse(set.body).success).toBe(true);
    const entry = (b: { items: { category_code: string }[] }) => b.items.find((e) => e.category_code === 'HEALTH_MEDICAL');
    expect(entry(set.body)).toMatchObject({ action: 'BLOCK', source: 'DEPARTMENT' });

    const other = await t.call('GET', `/api/admin/policy/departments/${deptB}`, { bearer: saToken });
    expect(entry(other.body)).toMatchObject({ action: 'WARN', source: 'ORG' });

    // Department Admin: own department readable and writable, another one is 403, the org policy is 403.
    const own = await t.call('GET', `/api/admin/policy/departments/${deptA}`, { bearer: daToken });
    expect(own.status).toBe(200);
    expect(entry(own.body)).toMatchObject({ action: 'BLOCK', source: 'DEPARTMENT' });
    expect((await t.call('GET', `/api/admin/policy/departments/${deptB}`, { bearer: daToken })).status).toBe(403);
    expect((await t.call('PUT', `/api/admin/policy/departments/${deptB}/HEALTH_MEDICAL`, { bearer: daToken, body: { action: 'ALLOW', enabled: true } })).status).toBe(403);
    expect((await t.call('DELETE', `/api/admin/policy/departments/${deptB}/HEALTH_MEDICAL`, { bearer: daToken })).status).toBe(403);
    expect((await t.call('PUT', '/api/admin/policy/org/HEALTH_MEDICAL', { bearer: daToken, body: { action: 'ALLOW', enabled: true } })).status).toBe(403);
    expect((await t.call('GET', '/api/admin/policy/org', { bearer: userToken })).status).toBe(403);

    const v = await version();
    const cleared = await t.call('DELETE', `/api/admin/policy/departments/${deptA}/HEALTH_MEDICAL`, { bearer: saToken });
    expect(entry(cleared.body)).toMatchObject({ action: 'WARN', source: 'ORG' });
    expect(cleared.body.version).toBe(v + 1);
    // Removing a non-existent override is a quiet no-op.
    expect((await t.call('DELETE', `/api/admin/policy/departments/${deptA}/HEALTH_MEDICAL`, { bearer: saToken })).body.version).toBe(v + 1);
  });

  it('a Department Admin edits their own department; a later org change does not override it; the audit names them', async () => {
    const entry = (b: { items: { category_code: string }[] }) => b.items.find((e) => e.category_code === 'VEHICLE');
    const v = await version();
    const set = await t.call('PUT', `/api/admin/policy/departments/${deptA}/VEHICLE`, { bearer: daToken, body: { action: 'BLOCK', enabled: false } });
    expect(set.status).toBe(200);
    expect(set.body.version).toBe(v + 1);
    expect(entry(set.body)).toMatchObject({ action: 'BLOCK', enabled: false, source: 'DEPARTMENT' });
    const last = (await fx.owner.query(`SELECT acting_admin_id, detail FROM "AdminAuditLog" WHERE action_type = 'POLICY_CHANGED' ORDER BY created_at DESC LIMIT 1`)).rows[0];
    expect(last.acting_admin_id).toBe(da.id);
    expect(last.detail).toMatchObject({ category_code: 'VEHICLE', enabled: false });

    // The System Admin changes the organisation value afterwards: the department keeps its own choice.
    await t.call('PUT', '/api/admin/policy/org/VEHICLE', { bearer: saToken, body: { action: 'ALLOW', enabled: true } });
    const after = await t.call('GET', `/api/admin/policy/departments/${deptA}`, { bearer: daToken });
    expect(entry(after.body)).toMatchObject({ action: 'BLOCK', enabled: false, source: 'DEPARTMENT' });
    const other = await t.call('GET', `/api/admin/policy/departments/${deptB}`, { bearer: saToken });
    expect(entry(other.body)).toMatchObject({ action: 'ALLOW', enabled: true, source: 'ORG' });

    const cleared = await t.call('DELETE', `/api/admin/policy/departments/${deptA}/VEHICLE`, { bearer: daToken });
    expect(entry(cleared.body)).toMatchObject({ action: 'ALLOW', source: 'ORG' });
  });

  it('404 for an unknown department', async () => {
    const res = await t.call('GET', '/api/admin/policy/departments/00000000-0000-4000-8000-000000000077', { bearer: saToken });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DEPARTMENT_NOT_FOUND');
  });

  // ---------- custom rules ----------

  it('creates an org-wide KEYWORD rule (normalised), bumps the version, audits without the definition', async () => {
    const v = await version();
    const res = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ name: `Keywords ${fx.salt}`, definition: ' alpha \n\nbeta\nalpha\n' }),
    });
    expect(res.status).toBe(201);
    expect(CustomRuleResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.definition).toBe('alpha\nbeta');
    expect(await version()).toBe(v + 1);
    const detail = (await audits('RULE_CHANGED')).at(-1)!.detail;
    expect(detail).toMatchObject({ name: `Keywords ${fx.salt}`, kind: 'KEYWORD', change: 'created' });
    expect(JSON.stringify(detail)).not.toContain('alpha');
  });

  it('creates a DEPARTMENTS rule with its links in ONE transaction; scope/department mismatches are 400', async () => {
    const res = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ name: `Dept ${fx.salt}`, kind: 'TOPIC', definition: 'internal salary discussions', scope: 'DEPARTMENTS', department_ids: [deptA, deptB] }),
    });
    expect(res.status).toBe(201);
    expect(res.body.department_ids.sort()).toEqual([deptA, deptB].sort());

    const none = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ scope: 'DEPARTMENTS', department_ids: [] }) });
    expect(none.status).toBe(400);
    expect(none.body.details.department_ids).toContain('rule.departments_required');
    const orgWithDepts = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ department_ids: [deptA] }) });
    expect(orgWithDepts.body.details.department_ids).toContain('rule.departments_not_allowed');

    // An unknown department rolls the whole rule back: no orphan rule, no version bump.
    const v = await version();
    const before = (await fx.owner.query(`SELECT count(*)::int AS n FROM "CustomRule"`)).rows[0].n;
    const unknown = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ name: `Ghost ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: ['00000000-0000-4000-8000-000000000088'] }),
    });
    expect(unknown.status).toBe(404);
    expect((await fx.owner.query(`SELECT count(*)::int AS n FROM "CustomRule"`)).rows[0].n).toBe(before);
    expect(await version()).toBe(v);
  });

  it('rejects an unsafe, invalid or backreferencing PATTERN at save, accepts a safe one', async () => {
    const save = (definition: string) => t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ kind: 'PATTERN', definition, name: `P ${fx.salt}` }) });
    const v = await version();
    for (const [definition, key] of [
      ['^(a+)+$', 'rule.pattern_unsafe'],
      ['(a|a)*b', 'rule.pattern_unsafe'],
      ['(', 'rule.pattern_invalid'],
      ['(a)\\1', 'rule.pattern_backreference'],
    ] as const) {
      const res = await save(definition);
      expect(res.status, definition).toBe(400);
      expect(res.body.details.definition, definition).toContain(key);
      expect(JSON.stringify(res.body)).not.toContain(definition);
    }
    expect((await save('a'.repeat(513))).status).toBe(400);
    expect(await version()).toBe(v);
    expect((await save('\\bEMP-\\d{6}\\b')).status).toBe(201);
  });

  it('edits and disables a rule; an unchanged save is a no-op; unknown id is 404', async () => {
    const created = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `Edit ${fx.salt}` }) });
    const id = created.body.id as string;
    const v = await version();
    const same = await t.call('PUT', `/api/admin/rules/${id}`, { bearer: saToken, body: rule({ name: `Edit ${fx.salt}` }) });
    expect(same.status).toBe(200);
    expect(await version()).toBe(v);

    const edited = await t.call('PUT', `/api/admin/rules/${id}`, {
      bearer: saToken,
      body: rule({ name: `Edit ${fx.salt}`, enabled: false, scope: 'DEPARTMENTS', department_ids: [deptB], action: 'BLOCK' }),
    });
    expect(edited.body).toMatchObject({ enabled: false, scope: 'DEPARTMENTS', department_ids: [deptB], action: 'BLOCK' });
    expect(await version()).toBe(v + 1);
    expect((await audits('RULE_CHANGED')).at(-1)!.detail).toMatchObject({
      change: 'updated',
      changed_fields: ['action', 'scope', 'departments', 'enabled'],
    });
    // Back to org-wide: the links are removed in the same transaction (scope trigger stays happy).
    const back = await t.call('PUT', `/api/admin/rules/${id}`, { bearer: saToken, body: rule({ name: `Edit ${fx.salt}` }) });
    expect(back.body).toMatchObject({ scope: 'ORG_WIDE', department_ids: [] });

    const missing = await t.call('PUT', '/api/admin/rules/00000000-0000-4000-8000-000000000055', { bearer: saToken, body: rule() });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RULE_NOT_FOUND');
  });

  it('a Department Admin never receives the text of a TOPIC rule (confidential description), a System Admin does', async () => {
    const topic = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ name: `Topic ${fx.salt}`, kind: 'TOPIC', definition: 'confidential acquisition plans', scope: 'DEPARTMENTS', department_ids: [deptA] }),
    });
    const pattern = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ name: `Pat ${fx.salt}`, kind: 'PATTERN', definition: 'EMP-[0-9]{6}', scope: 'DEPARTMENTS', department_ids: [deptA] }),
    });
    const asDa = (await t.call('GET', '/api/admin/rules', { bearer: daToken })).body.items;
    expect(asDa.find((r: { id: string }) => r.id === topic.body.id).definition).toBe('');
    expect(asDa.find((r: { id: string }) => r.id === pattern.body.id).definition).toBe('EMP-[0-9]{6}');
    // Not editable for them either: they cannot see what they would overwrite.
    expect(asDa.find((r: { id: string }) => r.id === topic.body.id).editable).toBe(false);
    expect((await t.call('PUT', `/api/admin/rules/${topic.body.id}`, { bearer: daToken, body: rule({ kind: 'TOPIC', definition: 'x', scope: 'DEPARTMENTS', department_ids: [deptA] }) })).status).toBe(403);
    const asSa = (await t.call('GET', '/api/admin/rules', { bearer: saToken })).body.items;
    expect(asSa.find((r: { id: string }) => r.id === topic.body.id).definition).toBe('confidential acquisition plans');
    // and nowhere else in the answer
    expect(JSON.stringify(asDa)).not.toContain('confidential acquisition plans');
  });

  it('Department Admin lists the rules of their department and edits only the ones that apply to it alone', async () => {
    const mine = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `Mine ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptA] }) });
    const theirs = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `Theirs ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptB] }) });
    const list = await t.call('GET', '/api/admin/rules', { bearer: daToken });
    expect(list.status).toBe(200);
    const ids = list.body.items.map((r: { id: string }) => r.id);
    expect(ids).toContain(mine.body.id);
    expect(ids).not.toContain(theirs.body.id);
    expect(list.body.items.find((r: { id: string }) => r.id === mine.body.id).editable).toBe(true);
    // Org-wide rules and rules of another department are not theirs to write.
    expect((await t.call('POST', '/api/admin/rules', { bearer: daToken, body: rule() })).status).toBe(403);
    expect((await t.call('POST', '/api/admin/rules', { bearer: daToken, body: rule({ scope: 'DEPARTMENTS', department_ids: [deptB] }) })).status).toBe(403);
    expect((await t.call('POST', '/api/admin/rules', { bearer: daToken, body: rule({ scope: 'DEPARTMENTS', department_ids: [deptA, deptB] }) })).status).toBe(403);
    expect((await t.call('PUT', `/api/admin/rules/${theirs.body.id}`, { bearer: daToken, body: rule({ scope: 'DEPARTMENTS', department_ids: [deptA] }) })).status).toBe(403);
    const orgWide = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `Org ${fx.salt}` }) });
    expect((await t.call('PUT', `/api/admin/rules/${orgWide.body.id}`, { bearer: daToken, body: rule({ scope: 'DEPARTMENTS', department_ids: [deptA] }) })).status).toBe(403);
    const relist = await t.call('GET', '/api/admin/rules', { bearer: daToken });
    expect(relist.body.items.find((r: { id: string }) => r.id === orgWide.body.id).editable).toBe(false);
    // Their own department: create and edit work, and the audit entry names the Department Admin.
    const own = await t.call('POST', '/api/admin/rules', { bearer: daToken, body: rule({ name: `DA ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptA] }) });
    expect(own.status).toBe(201);
    expect(own.body.editable).toBe(true);
    const edited = await t.call('PUT', `/api/admin/rules/${own.body.id}`, { bearer: daToken, body: rule({ name: `DA ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptA], action: 'BLOCK' }) });
    expect(edited.status).toBe(200);
    expect((await audits('RULE_CHANGED')).length).toBeGreaterThan(0);
    expect((await t.call('GET', '/api/admin/rules', { bearer: userToken })).status).toBe(403);
    const all = await t.call('GET', '/api/admin/rules', { bearer: saToken });
    expect(all.body.items.map((r: { id: string }) => r.id)).toContain(theirs.body.id);
  });

  // ---------- extension bundle ----------

  it('serves a resolved bundle: 24 entries, the user department override and applicable enabled rules only', async () => {
    await t.call('PUT', '/api/admin/policy/org/VEHICLE', { bearer: saToken, body: { action: 'WARN', enabled: true } });
    await t.call('PUT', `/api/admin/policy/departments/${deptA}/VEHICLE`, { bearer: saToken, body: { action: 'BLOCK', enabled: true } });
    const off = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `Off ${fx.salt}`, enabled: false }) });
    const forB = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `ForB ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptB] }) });
    const forA = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `ForA ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptA] }) });

    const res = await bundle(extA);
    expect(res.status).toBe(200);
    expect(PolicyBundleResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.policy).toHaveLength(24);
    expect(res.body.policy.find((e: { category_code: string }) => e.category_code === 'VEHICLE')).toMatchObject({ action: 'BLOCK' });
    const ids = res.body.rules.map((r: { id: string }) => r.id);
    expect(ids).toContain(forA.body.id);
    expect(ids).not.toContain(forB.body.id);
    expect(ids).not.toContain(off.body.id);
    expect(res.body.version).toBe(await version());
    expect(res.headers['cache-control']).toBe('private');
    expect(res.headers.etag).toMatch(/^"p\d+-[A-Za-z0-9_-]{16}"$/);
  });

  it('a user without a department gets organisation values and org-wide rules only (WEB-FR-070)', async () => {
    const res = await bundle(extNoDept);
    expect(res.status).toBe(200);
    expect(res.body.policy.find((e: { category_code: string }) => e.category_code === 'VEHICLE')).toMatchObject({ action: 'WARN' });
    for (const r of res.body.rules) {
      const full = (await t.call('GET', '/api/admin/rules', { bearer: saToken })).body.items.find((x: { id: string }) => x.id === r.id);
      expect(full.scope).toBe('ORG_WIDE');
    }
  });

  it('same version answers 304 with no body; a change gives 200 and a new ETag; ETags differ per department', async () => {
    const first = await bundle(extA);
    const etag = first.headers.etag as string;
    const notModified = await bundle(extA, { 'if-none-match': etag });
    expect(notModified.status).toBe(304);
    expect(notModified.text).toBe('');
    expect(notModified.headers.etag).toBe(etag);
    expect(notModified.headers['cache-control']).toBe('private');
    expect((await bundle(extA, { 'if-none-match': `W/${etag}, "other"` })).status).toBe(304);
    expect((await bundle(extA, { 'if-none-match': '"p1-stale"' })).status).toBe(200);

    expect((await bundle(extNoDept)).headers.etag).not.toBe(etag);

    await t.call('PUT', '/api/admin/policy/org/FILE_PATH', { bearer: saToken, body: { action: 'BLOCK', enabled: true } });
    const changed = await bundle(extA, { 'if-none-match': etag });
    expect(changed.status).toBe(200);
    expect(changed.headers.etag).not.toBe(etag);
    expect(changed.body.version).toBe(first.body.version + 1);
  });

  it('every bundle entry carries its fixed risk level', async () => {
    const res = await bundle(extA);
    expect(res.status).toBe(200);
    const org = await t.call('GET', '/api/admin/policy/org', { bearer: saToken });
    for (const e of res.body.policy) {
      expect(e.risk_level).toBe(org.body.items.find((o: { category_code: string }) => o.category_code === e.category_code).default_risk_level);
    }
  });

  it('the bundle holds no auth material and is refused to web tokens and anonymous callers', async () => {
    const res = await bundle(extA);
    const keys = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
      }
    };
    walk(res.body);
    expect([...keys].sort()).toEqual(['action', 'category_code', 'definition', 'enabled', 'id', 'kind', 'name', 'policy', 'risk_level', 'rules', 'version'].sort());
    expect((await bundle(saToken)).status).toBe(401);
    expect((await t.call('GET', '/api/policy/bundle')).status).toBe(401);
  });

  it('a deactivated user (token revoked) cannot fetch the bundle', async () => {
    const gone = await fx.user('p-gone', { role: 'USER', departmentId: deptA });
    const token = await t.app.get(TokenService).signAccess({ sub: gone.id, tv: 0 }, 'extension');
    expect((await bundle(token)).status).toBe(200);
    await fx.owner.query(`UPDATE "User" SET status = 'DEACTIVATED', token_version = token_version + 1 WHERE id = $1`, [gone.id]);
    expect((await bundle(token)).status).toBe(401);
  });

  it('validates KEYWORD and TOPIC definitions (empty, too many words, word too long, over length)', async () => {
    const save = (over: Record<string, unknown>) => t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule(over) });
    expect((await save({ definition: '   ' })).body.details.definition).toContain('rule.definition_required');
    expect((await save({ definition: Array.from({ length: 201 }, (_, i) => `w${i}`).join(String.fromCharCode(10)) })).body.details.definition).toContain('rule.too_many_keywords');
    expect((await save({ definition: 'x'.repeat(65) })).body.details.definition).toContain('rule.keyword_too_long');
    expect((await save({ kind: 'TOPIC', definition: 'x'.repeat(4001) })).status).toBe(400);
    expect((await save({ kind: 'TOPIC', definition: 'x'.repeat(4000), name: `Topic ${fx.salt}` })).status).toBe(201);
    expect((await save({ department_ids: [], scope: 'DEPARTMENTS', definition: 'ok' })).status).toBe(400);
  });

  it('a PATTERN is stored verbatim (not trimmed) and checked under the extension flags', async () => {
    const res = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ kind: 'PATTERN', definition: '\\bTRAIL \\d{3}\\b ', name: `Verbatim ${fx.salt}` }),
    });
    expect(res.status).toBe(201);
    expect(res.body.definition.endsWith(' ')).toBe(true);
    const unsafeCase = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ kind: 'PATTERN', definition: '^(?:[a-z]|[A-Z])+$', name: `Case ${fx.salt}` }),
    });
    expect(unsafeCase.body.details.definition).toContain('rule.pattern_unsafe');
  });

  it('If-None-Match "*" matches; departments get different ETags; moving departments changes the ETag', async () => {
    const mover = await fx.user('p-mover', { role: 'USER', departmentId: deptA });
    const token = await t.app.get(TokenService).signAccess({ sub: mover.id, tv: 0 }, 'extension');
    const inA = await bundle(token);
    expect((await bundle(token, { 'if-none-match': '*' })).status).toBe(304);
    await fx.owner.query('UPDATE "User" SET department_id = $1 WHERE id = $2', [deptB, mover.id]);
    const inB = await bundle(token);
    expect(inB.headers.etag).not.toBe(inA.headers.etag);
    expect((await bundle(token, { 'if-none-match': inA.headers.etag as string })).status).toBe(200);
  });

  it('a Department Admin sees only their own department among a shared rule departments', async () => {
    const shared = await t.call('POST', '/api/admin/rules', {
      bearer: saToken,
      body: rule({ name: `Shared ${fx.salt}`, scope: 'DEPARTMENTS', department_ids: [deptA, deptB] }),
    });
    const list = await t.call('GET', '/api/admin/rules', { bearer: daToken });
    const mine = list.body.items.find((r: { id: string }) => r.id === shared.body.id);
    expect(mine.department_ids).toEqual([deptA]);
    // A rule shared with another department is read-only for them.
    expect(mine.editable).toBe(false);
    expect((await t.call('PUT', `/api/admin/rules/${shared.body.id}`, { bearer: daToken, body: rule({ scope: 'DEPARTMENTS', department_ids: [deptA] }) })).status).toBe(403);
  });

  it('an update that changes the action records the old values in the audit entry', async () => {
    const created = await t.call('POST', '/api/admin/rules', { bearer: saToken, body: rule({ name: `Old ${fx.salt}` }) });
    await t.call('PUT', `/api/admin/rules/${created.body.id}`, { bearer: saToken, body: rule({ name: `Old ${fx.salt}`, action: 'BLOCK', risk_level: 'HIGH', enabled: false }) });
    expect((await audits('RULE_CHANGED')).at(-1)!.detail).toMatchObject({ old_action: 'WARN', old_risk_level: 'MEDIUM', old_enabled: true });
  });

  it('a password check keeps the fixtures valid', () => {
    expect(TEST_PASSWORD.length).toBeGreaterThan(8);
  });
});
