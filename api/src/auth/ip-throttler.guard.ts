import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from './client-ip';

/** @nestjs/throttler keyed by the normalized client address (IPv6 by /64). */
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientIp(req as unknown as Request);
  }
}
