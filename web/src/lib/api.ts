import type { ApiErrorEnvelope } from '@hares/contract';

/** An error answer from the API (or the network), reduced to what the UI needs. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Machine-readable code (`INVALID_CREDENTIALS`, `RATE_LIMITED`, ...) or `NETWORK` / `UNKNOWN`. */
    readonly code: string,
    /** Field-level validation messages: field name -> message keys (never the entered values). */
    readonly details?: Record<string, string[]>,
    readonly requestId?: string,
    /** Seconds from the Retry-After header (429). */
    readonly retryAfter?: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** The session, as the API client needs it (kept out of this file to avoid a cycle). */
export interface AuthHooks {
  getToken(): string | null;
  /** Get a new access token (single-flight); null when the session is gone. */
  refresh(): Promise<string | null>;
  /** The session could not be recovered: the user must sign in again. */
  onAuthLost(): void;
}

let hooks: AuthHooks | null = null;
export const configureApi = (h: AuthHooks | null): void => {
  hooks = h;
};

export interface RequestOptions {
  body?: unknown;
  /** Attach the bearer token and refresh once on an expired token. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

const BASE = '/api';

async function send(method: string, path: string, o: RequestOptions, token: string | null): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      signal: o.signal,
      headers: {
        Accept: 'application/json',
        ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...o.headers,
      },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK');
  }
}

async function toError(res: Response): Promise<ApiError> {
  let env: Partial<ApiErrorEnvelope> = {};
  try {
    env = (await res.json()) as Partial<ApiErrorEnvelope>;
  } catch {
    /* not JSON (proxy error page): fall through */
  }
  const retry = Number(res.headers.get('retry-after'));
  return new ApiError(
    res.status,
    typeof env.code === 'string' ? env.code : 'UNKNOWN',
    env.details,
    typeof env.request_id === 'string' ? env.request_id : undefined,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  );
}

/**
 * JSON request to the API. With `auth` (default) the bearer token is attached;
 * on a 401 for an expired or revoked token the session is refreshed ONCE and the
 * request is repeated; if that fails the user is signed out. Errors always become
 * an ApiError with the envelope's code, so screens map codes to messages.
 */
export async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
  const useAuth = o.auth !== false && hooks !== null;
  let res = await send(method, path, o, useAuth ? hooks!.getToken() : null);

  if (res.status === 401 && useAuth) {
    const err = await toError(res.clone());
    if (err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN') {
      const fresh = await hooks!.refresh();
      if (fresh) {
        res = await send(method, path, o, fresh);
      } else {
        hooks!.onAuthLost();
        throw err;
      }
    } else if (err.code === 'TOKEN_REVOKED' || err.code === 'ACCOUNT_INACTIVE') {
      hooks!.onAuthLost();
      throw err;
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, o?: RequestOptions) => request<T>('GET', path, o),
  post: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('POST', path, { ...o, body: body ?? {} }),
  put: <T>(path: string, body: unknown, o?: RequestOptions) => request<T>('PUT', path, { ...o, body }),
  patch: <T>(path: string, body: unknown, o?: RequestOptions) => request<T>('PATCH', path, { ...o, body }),
  delete: <T>(path: string, o?: RequestOptions) => request<T>('DELETE', path, o),
};
