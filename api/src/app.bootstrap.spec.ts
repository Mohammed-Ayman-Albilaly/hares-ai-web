import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import * as http from 'node:http';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HealthResponseSchema } from '@hares/contract';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { PrismaService } from './prisma/prisma.service';

// ---------------------------------------------------------------------------
// API boot smoke test.
//
// This starts the real Nest application graph (AppModule: ConfigModule,
// PrismaModule, CommonModule, HealthModule) the same way `main.ts` does, with
// only PrismaService replaced by a stub so the test never touches the database.
// It proves that the dependency-injection graph resolves and that the app
// actually boots and serves routes — catching the class of bootstrap failure
// (e.g. a missing @Inject / non-@Optional constructor param) that unit tests
// cannot see because they never build the container.
//
// It is skipped (with a message) when DATABASE_URL is not configured, because
// ConfigModule validates it at boot.
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn(
    '[app-boot] DATABASE_URL is not set — skipping the API boot smoke test.',
  );
}

describe.skipIf(!databaseUrl)('API boot smoke test', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => ({ rows: [] }) })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  function get(path: string): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const address = app.getHttpServer().address() as { port: number };
      const req = http.get(
        { host: '127.0.0.1', port: address.port, path },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              body: data ? JSON.parse(data) : undefined,
            }),
          );
        },
      );
      req.on('error', reject);
    });
  }

  it('boots the full app graph and serves GET /api/health', async () => {
    const { status, body } = await get('/api/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'hares-api',
    });
    expect(typeof (body as { request_id: unknown }).request_id).toBe('string');
    expect(HealthResponseSchema.safeParse(body).success).toBe(true);
  });

  it('returns the error envelope for an unknown route (GET /api/nonexistent)', async () => {
    const { status, body } = await get('/api/nonexistent');
    expect(status).toBe(404);
    expect(body).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      path: '/api/nonexistent',
    });
    expect(typeof (body as { request_id: unknown }).request_id).toBe('string');
  });
});
