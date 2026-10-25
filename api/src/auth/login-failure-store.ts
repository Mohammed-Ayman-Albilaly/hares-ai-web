import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ClientKind } from './auth.constants';
import {
  ACCOUNT_FREE_FAILURES,
  SOURCE_FREE_FAILURES,
  THROTTLE_MAX_DELAY_SECONDS,
  THROTTLE_WINDOW_SECONDS,
} from './throttle';

export interface ThrottleKeys {
  account: string;
  source: string;
}

type KeyType = 'ACCOUNT' | 'SOURCE';

/**
 * Persisted login-attempt counters (table LoginAttempt), one row per account
 * key and one per source-address key. Keys are SHA-256 hashes, so the table
 * never holds an email or an IP address. The client kind is part of the key,
 * so web and extension logins are throttled independently.
 *
 * Attempts are reserved *before* the password is checked, in one atomic SQL
 * statement per key (`tryAttempt`): it refuses while a delay is running, and
 * otherwise counts the attempt and sets the next delay. So N parallel requests
 * cannot all slip through before the first failure is recorded. A success
 * then refunds the reservation. All time comparisons use the database clock.
 *
 * The counter resets only after 15 quiet minutes (the window is anchored to
 * the last attempt), so waiting out each delay never earns new free guesses.
 * Unknown emails are counted the same way, so the throttle never reveals
 * whether an account exists.
 */
@Injectable()
export class LoginFailureStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  keys(email: string, ip: string, client: ClientKind): ThrottleKeys {
    return throttleKeys(email, ip, client);
  }

  /**
   * Reserve one attempt on both keys. Returns 0 when allowed, otherwise the
   * seconds to wait (Retry-After).
   */
  async reserve(keys: ThrottleKeys): Promise<number> {
    const account = await this.tryAttempt(keys.account, 'ACCOUNT', ACCOUNT_FREE_FAILURES);
    if (account > 0) return account;
    return this.tryAttempt(keys.source, 'SOURCE', SOURCE_FREE_FAILURES);
  }

  /** The password was right: clear the account counter, refund the source reservation. */
  async succeeded(keys: ThrottleKeys): Promise<void> {
    await this.clearAccount(keys.account);
    await this.prisma.$executeRaw`
      UPDATE "LoginAttempt" SET failure_count = GREATEST(failure_count - 1, 0)
      WHERE key = ${keys.source} AND key_type = 'SOURCE'::key_type`;
  }

  /** Reserve one attempt on a single account-type key (e.g. change-password per user). */
  reserveKey(key: string): Promise<number> {
    return this.tryAttempt(key, 'ACCOUNT', ACCOUNT_FREE_FAILURES);
  }

  async clearAccount(accountKey: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({ where: { key: accountKey, keyType: 'ACCOUNT' } });
  }

  /** A password reset clears the account counters of both clients. */
  async clearAccountAllClients(email: string): Promise<void> {
    for (const client of ['web', 'extension'] as const) {
      await this.clearAccount(throttleKeys(email, '', client).account);
    }
  }

  /**
   * One atomic statement: refuse while next_allowed_at is in the future,
   * otherwise count the attempt (reset to 1 after a quiet window) and set the
   * next delay: free for the first `free` attempts, then 2, 4, 8 ... seconds,
   * capped (same rule as `delayAfterFailures`).
   */
  private async tryAttempt(key: string, keyType: KeyType, free: number): Promise<number> {
    const win = THROTTLE_WINDOW_SECONDS;
    const cap = THROTTLE_MAX_DELAY_SECONDS;
    // N = this attempt's number: 1 after a quiet window, otherwise previous + 1.
    const counted = await this.prisma.$queryRaw<{ failure_count: number }[]>`
      INSERT INTO "LoginAttempt" AS la (key, key_type, failure_count, window_start, next_allowed_at)
      VALUES (${key}, ${keyType}::key_type, 1, now(), NULL)
      ON CONFLICT (key, key_type) DO UPDATE SET
        failure_count = (CASE WHEN la.window_start < now() - make_interval(secs => ${win}) THEN 1 ELSE la.failure_count + 1 END),
        window_start = now(),
        next_allowed_at = CASE WHEN (CASE WHEN la.window_start < now() - make_interval(secs => ${win}) THEN 1 ELSE la.failure_count + 1 END) > ${free}::int
          THEN now() + make_interval(secs => LEAST(power(2, LEAST((CASE WHEN la.window_start < now() - make_interval(secs => ${win}) THEN 1 ELSE la.failure_count + 1 END) - ${free}::int, 20))::int, ${cap}::int))
          ELSE NULL END
      WHERE la.next_allowed_at IS NULL OR la.next_allowed_at <= now()
      RETURNING la.failure_count`;
    if (counted.length > 0) return 0;

    const wait = await this.prisma.$queryRaw<{ wait: number }[]>`
      SELECT GREATEST(1, ceil(extract(epoch FROM next_allowed_at - now())))::int AS wait
      FROM "LoginAttempt" WHERE key = ${key} AND key_type = ${keyType}::key_type`;
    return wait[0]?.wait ?? 1;
  }
}

/** Hashed counter keys for one login attempt. */
export function throttleKeys(email: string, ip: string, client: ClientKind): ThrottleKeys {
  return {
    account: hashKey(`${client}:account:${email.trim().toLowerCase()}`),
    source: hashKey(`${client}:source:${ip}`),
  };
}

/** Key for change-password attempts of one signed-in user. */
export function changePasswordKey(userId: string): string {
  return hashKey(`change-password:${userId}`);
}

function hashKey(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
