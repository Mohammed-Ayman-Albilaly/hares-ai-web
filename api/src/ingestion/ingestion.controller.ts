import { Body, Controller, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { IngestLogResponse, LogEvent } from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { ExtensionOnly } from '../common/guards/extension.guard';
import { IngestionBodyPipe } from './ingestion-body.pipe';
import { IngestionRateLimiter } from './ingestion-rate-limiter';
import { IngestionRejectedException } from './ingestion-rejected.exception';
import { IngestionService } from './ingestion.service';

/**
 * `POST /api/logs` (extension only). 201 for a new event, 200 for a duplicate
 * log_id (idempotent acknowledgement). The per-address request window is
 * skipped here: a per-user limit applies instead (one NAT address can serve a
 * whole organisation).
 */
@ExtensionOnly()
@SkipThrottle()
@Controller('logs')
export class IngestionController {
  constructor(
    @Inject(IngestionService) private readonly ingestion: IngestionService,
    @Inject(IngestionRateLimiter) private readonly limiter: IngestionRateLimiter,
  ) {}

  @Post()
  async ingest(
    @CurrentUser() user: AuthUser,
    @Body(new IngestionBodyPipe()) event: LogEvent,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IngestLogResponse> {
    const wait = this.limiter.take(user.id);
    if (wait > 0) {
      throw new IngestionRejectedException(
        'RATE_LIMITED',
        HttpStatus.TOO_MANY_REQUESTS,
        'Too many events. Try again later.',
        undefined,
        wait,
      );
    }
    const { created } = await this.ingestion.ingest(user, event);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { log_id: event.log_id };
  }
}
