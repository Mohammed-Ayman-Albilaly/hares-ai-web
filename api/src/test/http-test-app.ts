import 'dotenv/config';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Type } from '@nestjs/common';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { throttleKeys } from '../auth/login-failure-store';

// ---------------------------------------------------------------------------
// Shared helpers for HTTP integration suites. The app connects as hares_app
// (APP_DATABASE_URL); fixtures are written and removed with the owner role
// (DATABASE_URL). SYNTHETIC DATA ONLY.
// ---------------------------------------------------------------------------

export const ownerUrl = process.env.DATABASE_URL;
export const dbEnabled = Boolean(process.env.DATABASE_URL && process.env.APP_DATABASE_URL);

export const TEST_PASSWORD = 'Synthetic#Pass1';

export interface HttpResult {
  status: number;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  headers: http.IncomingHttpHeaders;
  cookies: string[];
  text: string;
}

export interface TestApp {
  app: NestExpressApplication;
  /** Synthetic client address sent as X-Forwarded-For (isolates throttle counters per suite). */
  ip: string;
  call(
    method: string,
    path: string,
    opts?: { body?: unknown; rawBody?: string; headers?: Record<string, string>; bearer?: string },
  ): Promise<HttpResult>;
  close(): Promise<void>;
}

/** Boot the real AppModule on a random port, exactly like main.ts. */
export async function bootTestApp(
  opts: { controllers?: Type[]; override?: (b: TestingModuleBuilder) => TestingModuleBuilder } = {},
): Promise<TestApp> {
  let builder = Test.createTestingModule({ imports: [AppModule], controllers: opts.controllers ?? [] });
  if (opts.override) builder = opts.override(builder);
  // TRUST_PROXY=loopback (vitest.config.ts) makes Express honour this address.
  const ip = `10.${rand255()}.${rand255()}.${rand255()}`;
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;

  const call: TestApp['call'] = (method, path, o = {}) => {
    const payload = o.rawBody ?? (o.body === undefined ? undefined : JSON.stringify(o.body));
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            ...(payload ? { 'content-type': 'application/json' } : {}),
            'x-forwarded-for': ip,
            ...(o.bearer ? { authorization: `Bearer ${o.bearer}` } : {}),
            ...o.headers,
          },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let body: unknown;
            try {
              body = data ? JSON.parse(data) : undefined;
            } catch {
              body = undefined;
            }
            resolve({
              status: res.statusCode ?? 0,
              body,
              headers: res.headers,
              cookies: res.headers['set-cookie'] ?? [],
              text: data,
            });
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  return { app, ip, call, close: () => app.close() };
}

function rand255(): number {
  return Math.floor(Math.random() * 254) + 1;
}

/** Delete the throttle counters a suite created (its emails and its IP, both clients). */
export async function clearThrottle(owner: Pool, emails: string[], ip: string): Promise<void> {
  const keys = new Set<string>();
  for (const client of ['web', 'extension'] as const) {
    for (const e of emails) keys.add(throttleKeys(e, ip, client).account);
    keys.add(throttleKeys('', ip, client).source);
  }
  await owner.query('DELETE FROM "LoginAttempt" WHERE key = ANY($1::text[])', [[...keys]]);
}

/**
 * Synthetic fixture factory. Every row it creates is tagged with a per-run salt
 * and removed by `cleanup()`.
 */
export class Fixtures {
  readonly salt = randomUUID().slice(0, 8);
  readonly owner = new Pool({ connectionString: ownerUrl });
  private readonly departments: string[] = [];
  readonly emails: string[] = [];
  private hash?: Promise<string>;

  email(tag: string): string {
    return `${tag}-${this.salt}@synthetic.test`;
  }

  async department(name = 'Dept', active = true): Promise<string> {
    const id = randomUUID();
    await this.owner.query('INSERT INTO "Department" (id, name, active) VALUES ($1, $2, $3)', [
      id,
      `${name} ${this.salt}`,
      active,
    ]);
    this.departments.push(id);
    return id;
  }

  /** Insert a user directly (status/role/department as given, password TEST_PASSWORD). */
  async user(
    tag: string,
    opts: {
      status?: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'DEACTIVATED';
      role?: 'SYSTEM_ADMIN' | 'DEPARTMENT_ADMIN' | 'USER' | null;
      departmentId?: string | null;
    } = {},
  ): Promise<{ id: string; email: string }> {
    const id = randomUUID();
    const email = this.email(tag);
    this.emails.push(email);
    const status = opts.status ?? 'ACTIVE';
    const role = opts.role === undefined ? (status === 'ACTIVE' || status === 'DEACTIVATED' ? 'USER' : null) : opts.role;
    const departmentId = opts.departmentId === undefined ? null : opts.departmentId;
    this.hash ??= bcrypt.hash(TEST_PASSWORD, 12);
    await this.owner.query(
      `INSERT INTO "User" (id, full_name, email, password_hash, role, department_id, status, registered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [id, `Synthetic ${tag}`, email, await this.hash, role, departmentId, status],
    );
    return { id, email };
  }

  /** Remove every row created for this run (children first). */
  async cleanup(
    extra: (owner: Pool, salt: string) => Promise<void> = async () => {},
    ip?: string,
  ): Promise<void> {
    if (ip) await clearThrottle(this.owner, this.emails, ip);
    const like = `%-${this.salt}@synthetic.test`;
    const users = `SELECT id FROM "User" WHERE email LIKE $1`;
    await extra(this.owner, this.salt);
    await this.owner.query(`DELETE FROM "RefreshToken" WHERE user_id IN (${users})`, [like]);
    await this.owner.query(`DELETE FROM "PasswordResetToken" WHERE user_id IN (${users})`, [like]);
    await this.owner.query(`UPDATE "User" SET approved_by = NULL WHERE email LIKE $1`, [like]);
    await this.owner.query(`DELETE FROM "User" WHERE email LIKE $1`, [like]);
    if (this.departments.length > 0) {
      await this.owner.query('DELETE FROM "Department" WHERE id = ANY($1::uuid[])', [this.departments]);
    }
    await this.owner.end();
  }
}
