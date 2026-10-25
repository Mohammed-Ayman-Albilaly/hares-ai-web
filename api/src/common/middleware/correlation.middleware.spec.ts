import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import type { Request } from 'express';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveRequestId } from './correlation.middleware';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reqWithHeader(value?: string): Request {
  return {
    headers: value === undefined ? {} : { 'x-request-id': value },
  } as unknown as Request;
}

describe('resolveRequestId', () => {
  it('accepts a matching x-request-id', () => {
    expect(resolveRequestId(reqWithHeader('req_abc.123-456'))).toBe(
      'req_abc.123-456',
    );
  });

  it('trims the header value', () => {
    expect(resolveRequestId(reqWithHeader('  req-abc  '))).toBe('req-abc');
  });

  it('replaces an invalid header with a generated UUID', () => {
    const id = resolveRequestId(reqWithHeader('invalid!! id'));
    expect(id).toMatch(UUID_RE);
    expect(id).not.toBe('invalid!! id');
  });

  it('replaces an over-length header with a generated UUID', () => {
    const longHeader = 'a'.repeat(129);
    const id = resolveRequestId(reqWithHeader(longHeader));
    expect(id).toMatch(UUID_RE);
    expect(id).not.toBe(longHeader);
  });

  it('generates a UUID when no header is present', () => {
    expect(resolveRequestId(reqWithHeader())).toMatch(UUID_RE);
  });
});

describe('correlation + body parsing', () => {
  let app: NestExpressApplication;
  let server: Server;
  let port: number;

  function rawRequest(opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: opts.path,
          method: opts.method,
          headers: opts.headers,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }),
          );
        },
      );
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://hares:hares@localhost:5432/hares';

    const prismaMock = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);

    await app.listen(0);
    server = app.getHttpServer();
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns an error envelope with a real request_id and x-request-id header for a malformed JSON body', async () => {
    const res = await rawRequest({
      method: 'POST',
      path: '/api/health',
      headers: { 'content-type': 'application/json' },
      body: '{ "foo": ',
    });

    expect(res.status).toBe(400);
    const envelope = JSON.parse(res.body) as {
      code: string;
      message: string;
      request_id: string;
    };
    expect(envelope.code).toBe('BAD_REQUEST');
    expect(envelope.message).toBe('Bad request');
    expect(envelope.request_id).toMatch(UUID_RE);
    expect(res.headers['x-request-id']).toBe(envelope.request_id);
  });

  it('replaces an invalid x-request-id header with a generated one', async () => {
    const res = await rawRequest({
      method: 'GET',
      path: '/api/health',
      headers: { 'x-request-id': 'invalid!!header value' },
    });

    expect(res.status).toBe(200);
    const header = res.headers['x-request-id'];
    expect(header).toMatch(UUID_RE);
    expect(header).not.toBe('invalid!!header value');

    const body = JSON.parse(res.body) as { request_id: string };
    expect(body.request_id).toBe(header);
  });
});
