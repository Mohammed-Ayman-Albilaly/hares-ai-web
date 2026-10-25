import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PurgeService } from '../retention/purge.service';
import { ReconcileService } from '../retention/reconcile.service';

const HOUR_MS = 3_600_000;
/** Reconcile every 6 hours, purge once a day; the first run is a minute after start. */
const RECONCILE_EVERY_MS = 6 * HOUR_MS;
const PURGE_EVERY_MS = 24 * HOUR_MS;
const FIRST_RUN_DELAY_MS = 60_000;

/**
 * Scheduled maintenance jobs (single API instance, decision 27). They are on by
 * default and off under NODE_ENV=test (`JOBS=on|off` overrides). Each run logs
 * only counts, never data. A failing run is logged and the next run tries again.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private timers = new Map<string, NodeJS.Timeout>();
  private stopped = false;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ReconcileService) private readonly reconcile: ReconcileService,
    @Inject(PurgeService) private readonly purge: PurgeService,
  ) {}

  onApplicationBootstrap(): void {
    const setting = this.config.get<string>('JOBS');
    const enabled = setting ? setting === 'on' : this.config.get<string>('NODE_ENV') !== 'test';
    if (!enabled) return;
    this.schedule('reconcile', RECONCILE_EVERY_MS, () => this.runReconcile());
    this.schedule('purge', PURGE_EVERY_MS, () => this.runPurge());
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  async runReconcile(): Promise<void> {
    try {
      const r = await this.reconcile.reconcile();
      this.logger.log(`reconcile: ${r.eventRowsFixed} event rows and ${r.categoryRowsFixed} category rows fixed (from ${r.fromDay})`);
    } catch (e) {
      this.logger.error(`reconcile failed: ${(e as Error).message}`);
    }
  }

  async runPurge(): Promise<void> {
    try {
      const r = await this.purge.purge();
      if (!r) this.logger.warn('purge skipped: a previous run is still going');
      if (r) this.logger.log(`purge: ${r.activityLogs} activity logs, ${r.loginAttempts} login attempts, ${r.passwordResetTokens} reset tokens, ${r.refreshTokens} refresh tokens`);
    } catch (e) {
      this.logger.error(`purge failed: ${(e as Error).message}`);
    }
  }

  private schedule(name: string, everyMs: number, run: () => Promise<void>): void {
    const arm = (ms: number) => {
      if (this.stopped) return;
      const t = setTimeout(tick, ms);
      t.unref();
      this.timers.set(name, t); // one timer per job
    };
    const tick = () => {
      void run().finally(() => arm(everyMs));
    };
    arm(FIRST_RUN_DELAY_MS);
    this.logger.log(`job "${name}" scheduled every ${Math.round(everyMs / HOUR_MS)} h`);
  }
}
