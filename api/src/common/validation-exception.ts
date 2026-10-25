import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown by the Zod validation pipe when a payload fails validation.
 *
 * `details` maps the field name to a list of human-readable, localized-key
 * message strings. Per ARCHITECTURE §4 and DECISIONS #2, the messages must
 * never echo the received value (a prompt or placeholder is not logged or
 * returned) — they only describe what was expected / what was accepted.
 */
export class ValidationException extends HttpException {
  readonly code: string;
  readonly details: Record<string, string[]>;

  constructor(
    details: Record<string, string[]>,
    message = 'Request validation failed',
  ) {
    super(
      {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message,
        details,
      },
      HttpStatus.BAD_REQUEST,
    );
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}
