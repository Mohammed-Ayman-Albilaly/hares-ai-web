import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionRateLimiter } from './ingestion-rate-limiter';
import { IngestionService } from './ingestion.service';

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, IngestionRateLimiter],
})
export class IngestionModule {}
