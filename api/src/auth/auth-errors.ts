import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ErrorCode, WebAuthErrorCode } from '@hares/contract';

/** Codes used by the web auth routes plus the extension-only ones. */
export type AuthErrorCode = WebAuthErrorCode | Extract<ErrorCode, 'ACCOUNT_NO_ACCESS' | 'FORBIDDEN'>;

/** Safe, fixed messages. They never say whether an account exists (decision 29). */
const MESSAGES: Record<AuthErrorCode, string> = {
  EMAIL_TAKEN: 'This email is already registered.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_PENDING: 'Your account is waiting for administrator approval.',
  ACCOUNT_REJECTED: 'Your registration was rejected. Contact a system administrator.',
  ACCOUNT_INACTIVE: 'Your account is deactivated.',
  INVALID_TOKEN: 'Authentication is required.',
  TOKEN_EXPIRED: 'The access token has expired.',
  TOKEN_REVOKED: 'The session has been revoked. Please sign in again.',
  REFRESH_REUSED: 'The session has been revoked. Please sign in again.',
  ORIGIN_NOT_ALLOWED: 'Request origin is not allowed.',
  ACCOUNT_NO_ACCESS: 'This account has no access yet.',
  FORBIDDEN: 'This endpoint is not available for this client.',
};

/** 401 with a machine-readable code; the global filter renders the envelope. */
export function unauthorized(code: AuthErrorCode): UnauthorizedException {
  return new UnauthorizedException({ code, message: MESSAGES[code] });
}

export function forbidden(code: AuthErrorCode): ForbiddenException {
  return new ForbiddenException({ code, message: MESSAGES[code] });
}

export function authMessage(code: AuthErrorCode): string {
  return MESSAGES[code];
}
