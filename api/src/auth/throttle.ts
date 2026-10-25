/**
 * Progressive login throttle (decision 22, WEB-NFR-020).
 *
 * Per account: the first 4 failures cost nothing. From the 5th on, the next
 * attempt must wait 2, 4, 8, ... seconds, doubling each time and capped at 15
 * minutes. The counter resets after 15 quiet minutes (counted from the last
 * attempt). There is never a hard lockout: after the wait, the right password
 * always works, and it clears the account counter.
 *
 * Per source address the same rule applies with 20 free failures, because a
 * single-organisation deployment often puts every user behind one NAT address
 * and ordinary typos must not slow everyone down.
 *
 * The SQL in LoginFailureStore.tryAttempt implements the same formula.
 */
export const ACCOUNT_FREE_FAILURES = 4;
export const SOURCE_FREE_FAILURES = 20;
/** The account rule (used by the unit test and docs). */
export const THROTTLE_FREE_FAILURES = ACCOUNT_FREE_FAILURES;
export const THROTTLE_WINDOW_SECONDS = 15 * 60;
export const THROTTLE_MAX_DELAY_SECONDS = 15 * 60;

/** Delay (seconds) imposed after the given number of consecutive failures. */
export function delayAfterFailures(failures: number, free = THROTTLE_FREE_FAILURES): number {
  if (failures <= free) return 0;
  const exp = Math.min(failures - free, 20);
  return Math.min(2 ** exp, THROTTLE_MAX_DELAY_SECONDS);
}

/**
 * Per-endpoint request windows (@nestjs/throttler, in memory: single API
 * instance, decision 27). They sit in front of the progressive throttle and
 * cap raw request volume per source address.
 */
export const RATE_LIMITS = {
  /** Default for every route. */
  default: { ttl: 60_000, limit: 300 },
  login: { ttl: 60_000, limit: 20 },
  register: { ttl: 60 * 60_000, limit: 10 },
  forgotPassword: { ttl: 15 * 60_000, limit: 5 },
  changePassword: { ttl: 15 * 60_000, limit: 10 },
  resetPassword: { ttl: 15 * 60_000, limit: 10 },
} as const;

/** At most this many reset emails per account per window (silently skipped above it). */
export const RESET_EMAILS_PER_WINDOW = 3;
