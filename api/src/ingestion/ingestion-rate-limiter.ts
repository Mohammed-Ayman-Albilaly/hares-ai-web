import { Injectable } from '@nestjs/common';
import { INGESTION_RATE_LIMIT_PER_MINUTE } from '@hares/contract';

const WINDOW_MS = 60_000;

/**
 * Per-user fixed-window limit for log ingestion (in memory: a single API
 * instance, decision 27). It replaces the per-address window on this route,
 * because the whole organisation may share one NAT address while each user
 * has their own budget. Expired windows are dropped as they are seen.
 */
@Injectable()
export class IngestionRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  /** Returns 0 when the event may pass, otherwise the seconds until the window resets. */
  take(userId: string, now = Date.now(), limit = INGESTION_RATE_LIMIT_PER_MINUTE): number {
    this.sweep(now);
    const w = this.windows.get(userId);
    if (!w || w.resetAt <= now) {
      this.windows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
      return 0;
    }
    if (w.count >= limit) return Math.max(1, Math.ceil((w.resetAt - now) / 1000));
    w.count += 1;
    return 0;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < WINDOW_MS) return;
    this.lastSweep = now;
    for (const [id, w] of this.windows) if (w.resetAt <= now) this.windows.delete(id);
  }
}
