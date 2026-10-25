import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ErrorEnvelopeSchema } from '@hares/contract';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ValidationException } from '../validation-exception';

function mockHost(url = '/api/health') {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const request = { url, headers: {} };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  };
  return { response, request, host };
}

/** Run the filter and return what was passed to `response.json`. */
function capturedJson(exception: unknown, url?: string) {
  const { response, host } = mockHost(url);
  new AllExceptionsFilter().catch(exception, host as never);
  return response.json.mock.calls[0]?.[0];
}

describe('AllExceptionsFilter → error envelope', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces an envelope that satisfies the contract ErrorEnvelopeSchema', () => {
    const body = capturedJson(
      new ValidationException({ email: ['Invalid email format'] }, 'Validation failed'),
      '/api/test',
    );
    const parsed = ErrorEnvelopeSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body).toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: { email: ['Invalid email format'] },
      path: '/api/test',
    });
    // request_id falls back to 'unknown' since no async context / header exists.
    expect(typeof body.request_id).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns code and code-only details (never echoes the received value)', () => {
    const body = capturedJson(
      new ValidationException({ prompt: ['expected a string'] }, 'Validation failed'),
    );
    expect(body.code).toBe('VALIDATION_ERROR');
    // Only static messages, no echoed input value.
    expect(body.details.prompt).toEqual(['expected a string']);
    expect(JSON.stringify(body)).not.toContain('SensitivePromptValue');
  });

  it('maps a generic HttpException to a fixed code and message per status (no third-party message)', () => {
    const body = capturedJson(new BadRequestException('Bad input'));
    expect(body.status).toBe(400);
    expect(body.code).toBe('BAD_REQUEST');
    expect(body.message).toBe('Bad request');
    // The third-party message is not forwarded.
    expect(JSON.stringify(body)).not.toContain('Bad input');
  });

  it('maps a ServiceUnavailableException to 503 / INTERNAL_ERROR with a safe message', () => {
    const body = capturedJson(new ServiceUnavailableException('DB down'));
    expect(body.status).toBe(503);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('DB down');
  });

  it('renders an unknown error as 500 with a generic message (no leak)', () => {
    const body = capturedJson(new Error('private internal detail'));
    expect(body.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('private internal detail');
  });

  it('uses the x-request-id header as the correlation id when no context is set', () => {
    const { response, host } = (() => {
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      const request = { url: '/api/health', headers: { 'x-request-id': 'req-abc-123' } };
      const host = {
        switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
      };
      return { response, host };
    })();
    new AllExceptionsFilter().catch(new BadRequestException('x') as never, host as never);
    const body = response.json.mock.calls[0][0];
    expect(body.request_id).toBe('req-abc-123');
  });

  it('maps an unknown route to NOT_FOUND with a path starting with /api', () => {
    const body = capturedJson(new NotFoundException(), '/api/unknown-route');
    expect(body.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('Not found');
    expect(body.path.startsWith('/api')).toBe(true);
    expect(body.path).toBe('/api/unknown-route');
  });

  it('strips the query string from the path', () => {
    const body = capturedJson(new NotFoundException(), '/api/items?page=2');
    expect(body.path).toBe('/api/items');
  });

  it('maps a malformed JSON body to a fixed message that never echoes the input', () => {
    const parseError = Object.assign(new Error('Unexpected token } in JSON at position 19'), {
      status: HttpStatus.BAD_REQUEST,
      statusCode: HttpStatus.BAD_REQUEST,
      expose: true,
      type: 'entity.parse.failed',
      body: '{"prompt":"SENSITIVE_PROMPT_VALUE"}',
    });
    const body = capturedJson(parseError, '/api/data');
    expect(body.status).toBe(400);
    expect(body.code).toBe('BAD_REQUEST');
    expect(body.message).toBe('Bad request');
    expect(JSON.stringify(body)).not.toContain('Unexpected token');
    expect(JSON.stringify(body)).not.toContain('SENSITIVE_PROMPT_VALUE');
  });

  it('logs unexpected (5xx) exceptions server-side with message and stack, no request data', () => {
    const err = new Error('db connection refused');
    const body = capturedJson(err, '/api/health');
    expect(body.status).toBe(500);
    expect(errorSpy).toHaveBeenCalled();
    const [message, stack] = errorSpy.mock.calls[0];
    expect(message).toContain('db connection refused');
    expect(stack).toContain('Error: db connection refused');
    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join(' ');
    expect(logged).not.toContain('/api/health');
  });
});
