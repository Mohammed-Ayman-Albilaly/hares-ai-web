import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { HttpStatus } from '@nestjs/common';
import { ZodValidationPipe, formatZodError } from './zod-validation.pipe';
import { ValidationException } from '../validation-exception';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().positive(),
  });

  it('returns the parsed value for valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    const value = pipe.transform({ email: 'a@b.com', age: 30 }, {} as never);
    expect(value).toMatchObject({ email: 'a@b.com' });
    expect(typeof (value as { age: unknown }).age).toBe('number');
  });

  it('applies Zod coercion (string to number) and returns typed data', () => {
    const pipe = new ZodValidationPipe(z.object({ age: z.coerce.number().int() }));
    const value = pipe.transform({ age: '42' }, {} as never);
    expect(typeof (value as { age: unknown }).age).toBe('number');
    expect((value as { age: number }).age).toBeGreaterThan(0);
  });

  it('throws a ValidationException (400) with code-only details for invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    let caught: unknown;
    try {
      pipe.transform({ email: 'not-an-email', age: -5 }, {} as never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationException);
    const ex = caught as ValidationException;
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ex.code).toBe('VALIDATION_ERROR');
    expect(ex.details).toHaveProperty('email');
    expect(ex.details).toHaveProperty('age');
  });

  it('never echoes the received value in the details', () => {
    const pipe = new ZodValidationPipe(z.object({ prompt: z.string().min(10) }));
    let caught: unknown;
    try {
      pipe.transform({ prompt: 'short' }, {} as never);
    } catch (e) {
      caught = e;
    }
    const ex = caught as ValidationException;
    expect(JSON.stringify(ex.details)).not.toContain('short');
  });

  it('passes the value through when no schema is bound (global pipe default)', () => {
    const pipe = new ZodValidationPipe();
    const value = { anything: true };
    expect(pipe.transform(value, {} as never)).toBe(value);
  });
});

describe('formatZodError', () => {
  it('groups issues by field path using "." and falls back to "_" for the root', () => {
    const error = {
      issues: [
        { path: ['email'], message: 'invalid email' },
        { path: ['user', 'name'], message: 'required' },
        { path: [], message: 'root problem' },
      ],
    };
    expect(formatZodError(error)).toEqual({
      email: ['invalid email'],
      'user.name': ['required'],
      _: ['root problem'],
    });
  });
});
