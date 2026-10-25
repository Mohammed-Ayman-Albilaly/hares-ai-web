import { describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  HttpStatus,
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

  it('maps a generic HttpException to its status and message', () => {
    const body = capturedJson(new BadRequestException('Bad input'));
    expect(body.status).toBe(400);
    expect(body.code).toBe('INTERNAL_ERROR'); // a bare BadRequestException has no code
    expect(body.message).toBe('Bad input');
  });

  it('maps a ServiceUnavailableException to 503', () => {
    const body = capturedJson(new ServiceUnavailableException('DB down'));
    expect(body.status).toBe(503);
    expect(body.message).toBe('DB down');
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
});
