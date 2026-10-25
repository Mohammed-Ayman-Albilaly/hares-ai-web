import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';
import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import type { Request, Response } from 'express';
import { RedactLoggingInterceptor } from './redact-logging.interceptor';
import { runWithRequestContext } from '../request-context';

let logSpy: MockInstance;

function makeContext(opts: {
  url?: string;
  method?: string;
  statusCode?: number;
  body?: unknown;
} = {}): ExecutionContext {
  const url = opts.url ?? '/api/health';
  const req = {
    method: opts.method ?? 'GET',
    originalUrl: url,
    url,
    headers: {},
    body: opts.body ?? {},
  } as unknown as Request;
  const res = { statusCode: opts.statusCode ?? 200 } as unknown as Response;
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

/** Run the interceptor and return the joined log lines. */
async function runLog(
  opts: Parameters<typeof makeContext>[0],
  responseBody: unknown,
  requestId?: string,
): Promise<string> {
  const ctx = makeContext(opts);
  const next = { handle: () => of(responseBody) } as CallHandler;
  const interceptor = new RedactLoggingInterceptor();
  const observable = requestId
    ? runWithRequestContext(requestId, () => interceptor.intercept(ctx, next))
    : interceptor.intercept(ctx, next);
  await lastValueFrom(observable as never);
  return logSpy.mock.calls.map((c) => c[0]).join('\n');
}

describe('RedactLoggingInterceptor', () => {
  beforeEach(() => {
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs request_id, method, path without the query string, status and duration', async () => {
    const line = await runLog(
      { url: '/api/health?debug=1', method: 'GET', statusCode: 200 },
      { ok: true },
      'req-abc',
    );

    expect(line).toContain('req-abc');
    expect(line).toContain('GET');
    expect(line).toContain('/api/health');
    expect(line).not.toContain('debug=1');
    expect(line).toContain('200');
  });

  it('never logs the request or response body', async () => {
    const line = await runLog(
      {
        url: '/api/data',
        method: 'POST',
        statusCode: 201,
        body: { prompt: 'SENSITIVE_PROMPT_BODY' },
      },
      { result: 'SENSITIVE_RESPONSE_BODY' },
      'req-1',
    );

    expect(line).not.toContain('SENSITIVE_PROMPT_BODY');
    expect(line).not.toContain('SENSITIVE_RESPONSE_BODY');
  });

  it('falls back to "unknown" request id when no context is present', async () => {
    const line = await runLog({ url: '/api/health', method: 'GET' }, null);
    expect(line).toContain('unknown');
  });
});
