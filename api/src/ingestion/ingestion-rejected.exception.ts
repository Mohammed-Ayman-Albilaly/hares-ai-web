import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@hares/contract';

/**
 * A 400/403/413/429 with one of the extension error codes (contract ERROR_CODES).
 * `details` only ever holds constant text (accepted values, message keys), never
 * the received value (decision 2).
 */
export class IngestionRejectedException extends HttpException {
  constructor(
    code: Extract<
      ErrorCode,
      | 'VALIDATION_ERROR'
      | 'UNKNOWN_FIELD'
      | 'INVALID_ENUM'
      | 'UNSUPPORTED_SCHEMA_VERSION'
      | 'EVENT_TIME_OUT_OF_RANGE'
      | 'DEPARTMENT_INACTIVE'
      | 'USER_NOT_ACTIVE'
      | 'PAYLOAD_TOO_LARGE'
      | 'RATE_LIMITED'
    >,
    status: HttpStatus,
    message: string,
    details?: Record<string, string[]>,
    readonly retryAfterSeconds?: number,
  ) {
    super({ status, code, message, ...(details ? { details } : {}) }, status);
  }
}
