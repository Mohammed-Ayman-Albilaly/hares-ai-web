import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from './client-ip';

/**
 * @nestjs/throttler keyed by the normalized client address (IPv6 by /64).
 *
 * The constructor repeats the parent's dependencies with explicit tokens: the
 * running API (tsx) emits no `design:paramtypes`, so type-based injection of a
 * subclass fails at boot. The end-to-end suite (a real server process) caught it.
 */
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientIp(req as unknown as Request);
  }
}
