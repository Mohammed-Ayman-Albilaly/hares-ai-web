import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '@hares/contract';
import { REFRESH_TTL_SECONDS } from './auth.constants';

/**
 * The web refresh token lives only in this cookie:
 *  - HttpOnly: page scripts (and an XSS payload) cannot read it;
 *  - SameSite=Strict: the browser never sends it on cross-site requests;
 *  - Secure in production (HTTPS only);
 *  - Path=/api/auth: it is not sent to any other API route.
 */
function options(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: REFRESH_COOKIE_PATH };
}

export function setRefreshCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...options(secure), maxAge: REFRESH_TTL_SECONDS * 1000 });
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, options(secure));
}

/** Read the refresh cookie from the raw Cookie header (no cookie-parser needed). */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === REFRESH_COOKIE_NAME) {
      const value = part.slice(eq + 1).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}
