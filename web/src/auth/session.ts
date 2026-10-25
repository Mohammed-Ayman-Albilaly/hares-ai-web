import type { LoginResponse, UserPublic } from '@hares/contract';
import { ApiError, api, configureApi } from '@/lib/api';

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: UserPublic };

type Listener = () => void;

const LOCK_NAME = 'hares-refresh';
const CHANNEL_NAME = 'hares-auth';
/** Refresh this many seconds before the access token expires. */
const REFRESH_MARGIN_S = 60;
const MIN_REFRESH_DELAY_S = 10;

/**
 * The browser session (decisions 36, 37; ARCHITECTURE "Silent refresh").
 *
 *  - The access token lives only in memory (never localStorage); the refresh
 *    token is an HttpOnly cookie the page cannot read.
 *  - `boot()` runs once on page load: it asks /auth/refresh for a session before
 *    any route guard decides, so a reload does not bounce the user to login.
 *  - Refresh is single-flight: one call per tab at a time (a shared promise) and
 *    one across tabs (Web Locks). Reuse detection revokes a whole session when
 *    the same refresh token is sent twice, so two parallel refreshes would sign
 *    the user out.
 *  - A timer refreshes shortly before the access token expires, and the API
 *    client refreshes once on a 401 expired-token answer.
 *  - Sign-out in one tab signs out the others (BroadcastChannel).
 */
export class Session {
  private state: SessionState = { status: 'loading', user: null };
  private token: string | null = null;
  private listeners = new Set<Listener>();
  private inflight: Promise<string | null> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private channel: BroadcastChannel | null = null;
  private booted = false;
  /** Bumped whenever the session is cleared or replaced, so a refresh that was already in flight cannot undo it. */
  private gen = 0;

  constructor() {
    configureApi({
      getToken: () => this.token,
      refresh: () => this.refresh(),
      onAuthLost: () => this.clear(),
    });
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (e: MessageEvent) => {
        if (e.data === 'logout') this.clear(false);
      };
    }
  }

  // ---------- store contract (useSyncExternalStore) ----------

  getSnapshot = (): SessionState => this.state;
  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(next: SessionState): void {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  /** The current access token (for downloads that cannot go through fetch JSON). */
  accessToken(): string | null {
    return this.token;
  }

  // ---------- lifecycle ----------

  /** Restore the session from the refresh cookie. Safe to call more than once. */
  async boot(): Promise<void> {
    if (this.booted) return;
    this.booted = true;
    try {
      await this.refresh();
    } catch {
      /* network down at boot: the login page shows the connection message on submit */
    }
    if (this.state.status === 'loading') this.set({ status: 'anonymous', user: null });
  }

  async login(email: string, password: string): Promise<UserPublic> {
    const res = await api.post<LoginResponse>('/auth/login', { email, password }, { auth: false });
    this.adopt(res);
    return res.user;
  }

  /** Called after login or a password change: the server issued a session for this device. */
  adopt(res: LoginResponse): void {
    this.gen++;
    this.token = res.access_token;
    this.schedule(res.expires_in);
    this.set({ status: 'authenticated', user: res.user });
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {}, { auth: false });
    } catch {
      /* the cookie may already be gone; sign out locally regardless */
    }
    this.clear(true);
  }

  /** Forget the session locally. `broadcast` tells the other tabs. */
  clear(broadcast = false): void {
    this.gen++;
    this.token = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.set({ status: 'anonymous', user: null });
    if (broadcast) this.channel?.postMessage('logout');
  }

  // ---------- refresh ----------

  /** Single-flight refresh. Resolves with the new access token, or null if there is no session. */
  refresh(): Promise<string | null> {
    this.inflight ??= this.withLock(() => this.doRefresh()).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    return locks ? (locks.request(LOCK_NAME, fn) as Promise<T>) : fn();
  }

  private async doRefresh(): Promise<string | null> {
    const started = this.gen;
    try {
      const res = await api.post<LoginResponse>('/auth/refresh', {}, { auth: false });
      // Signed out (here or in another tab) or signed in again while this was in flight: drop the result.
      if (this.gen !== started) return null;
      this.adopt(res);
      return res.access_token;
    } catch (e) {
      // Only a 401 means "no session / revoked". Network errors and 5xx/429 keep the current session.
      if (e instanceof ApiError && e.status === 401) {
        if (this.gen === started) this.clear(false);
        return null;
      }
      throw e;
    }
  }

  private schedule(expiresInSeconds: number): void {
    if (this.timer) clearTimeout(this.timer);
    const delay = Math.max(MIN_REFRESH_DELAY_S, expiresInSeconds - REFRESH_MARGIN_S) * 1000;
    this.timer = setTimeout(() => void this.refresh().catch(() => undefined), delay);
  }
}

export const session = new Session();
