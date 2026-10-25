import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api';
import { empty, envelope, json, loginResponse, mockFetch } from '@/test/utils';
import { Session } from './session';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Session (silent refresh, decisions 36/37)', () => {
  it('boot restores the session from the refresh cookie before anything decides', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => json(loginResponse('USER')) });
    const s = new Session();
    expect(s.getSnapshot().status).toBe('loading');
    await s.boot();
    expect(s.getSnapshot()).toMatchObject({ status: 'authenticated', user: { role: 'USER' } });
  });

  it('boot without a session ends anonymous (not loading forever)', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => envelope(401, 'INVALID_TOKEN') });
    const s = new Session();
    await s.boot();
    expect(s.getSnapshot().status).toBe('anonymous');
  });

  it('boot with the network down also ends anonymous', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const s = new Session();
    await s.boot();
    expect(s.getSnapshot().status).toBe('anonymous');
  });

  it('refresh is single-flight: parallel callers share ONE request (reuse detection would sign the user out)', async () => {
    const m = mockFetch({ 'POST /api/auth/refresh': async () => json(loginResponse()) });
    const s = new Session();
    const results = await Promise.all([s.refresh(), s.refresh(), s.refresh()]);
    expect(results).toEqual(['access-token', 'access-token', 'access-token']);
    expect(m.count('POST /api/auth/refresh')).toBe(1);
    await s.refresh(); // a later call is a new flight
    expect(m.count('POST /api/auth/refresh')).toBe(2);
  });

  it('a failed refresh signs the user out and returns null', async () => {
    mockFetch({
      'POST /api/auth/login': () => json(loginResponse()),
      'POST /api/auth/refresh': () => envelope(401, 'REFRESH_REUSED'),
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    expect(s.getSnapshot().status).toBe('authenticated');
    expect(await s.refresh()).toBeNull();
    expect(s.getSnapshot().status).toBe('anonymous');
  });

  it('refreshes shortly before the access token expires', async () => {
    vi.useFakeTimers();
    const m = mockFetch({
      'POST /api/auth/login': () => json(loginResponse('USER', 120)),
      'POST /api/auth/refresh': () => json(loginResponse('USER', 120)),
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    await vi.advanceTimersByTimeAsync(59_000);
    expect(m.count('POST /api/auth/refresh')).toBe(0);
    await vi.advanceTimersByTimeAsync(2_000); // 120 s token, refresh at 60 s
    expect(m.count('POST /api/auth/refresh')).toBe(1);
  });

  it('logout clears the session even if the server call fails', async () => {
    mockFetch({
      'POST /api/auth/login': () => json(loginResponse()),
      'POST /api/auth/logout': () => envelope(500, 'INTERNAL_ERROR'),
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    await s.logout();
    expect(s.getSnapshot().status).toBe('anonymous');
    expect(s.accessToken()).toBeNull();
  });

  it('keeps the access token in memory only, never in web storage', async () => {
    mockFetch({ 'POST /api/auth/login': () => json(loginResponse()) });
    const s = new Session();
    await s.login('a@b.test', 'x');
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('access-token');
  });
});

describe('API client', () => {
  it('sends the bearer token and repeats ONCE after a refresh on TOKEN_EXPIRED', async () => {
    let first = true;
    const m = mockFetch({
      'POST /api/auth/login': () => json(loginResponse()),
      'POST /api/auth/refresh': () => json({ ...loginResponse(), access_token: 'fresh-token' }),
      'GET /api/profile': ({ headers }) => {
        if (first) {
          first = false;
          expect(headers.get('authorization')).toBe('Bearer access-token');
          return envelope(401, 'TOKEN_EXPIRED');
        }
        expect(headers.get('authorization')).toBe('Bearer fresh-token');
        return json({ ok: true });
      },
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    expect(await api.get('/profile')).toEqual({ ok: true });
    expect(m.count('GET /api/profile')).toBe(2);
    expect(m.count('POST /api/auth/refresh')).toBe(1);
  });

  it('signs out when the token is revoked and does not retry', async () => {
    const m = mockFetch({
      'POST /api/auth/login': () => json(loginResponse()),
      'GET /api/profile': () => envelope(401, 'TOKEN_REVOKED'),
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    await expect(api.get('/profile')).rejects.toMatchObject({ code: 'TOKEN_REVOKED' });
    expect(s.getSnapshot().status).toBe('anonymous');
    expect(m.count('GET /api/profile')).toBe(1);
  });

  it('turns an error answer into an ApiError with code, details, request id and Retry-After', async () => {
    mockFetch({
      'POST /api/auth/login': () =>
        new Response(JSON.stringify({ status: 429, code: 'RATE_LIMITED', message: 'x', path: '/', timestamp: 't', request_id: 'rid-1' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '7' },
        }),
    });
    new Session();
    const err = await api.post('/auth/login', {}, { auth: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 7, requestId: 'rid-1' });
  });

  it('a network failure is code NETWORK; a non-JSON error page is UNKNOWN; 204 has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    new Session();
    await expect(api.get('/x', { auth: false })).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 })));
    await expect(api.get('/x', { auth: false })).rejects.toMatchObject({ code: 'UNKNOWN', status: 502 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(empty()));
    expect(await api.post('/x', {}, { auth: false })).toBeUndefined();
  });
});

describe('Session races and errors (review findings)', () => {
  it('a server error during refresh keeps the session', async () => {
    let fail = false;
    mockFetch({
      'POST /api/auth/login': () => json(loginResponse()),
      'POST /api/auth/refresh': () => (fail ? envelope(503, 'SERVICE_UNAVAILABLE') : json(loginResponse())),
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    fail = true;
    await expect(s.refresh()).rejects.toMatchObject({ status: 503 });
    expect(s.getSnapshot().status).toBe('authenticated');
  });

  it('a refresh that finishes after logout does not bring the session back', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    mockFetch({
      'POST /api/auth/login': () => json(loginResponse()),
      'POST /api/auth/logout': () => json({}),
      'POST /api/auth/refresh': async () => {
        await gate;
        return json(loginResponse());
      },
    });
    const s = new Session();
    await s.login('a@b.test', 'x');
    const pending = s.refresh();
    await s.logout();
    release();
    await pending;
    expect(s.getSnapshot().status).toBe('anonymous');
    expect(s.accessToken()).toBeNull();
  });
});
