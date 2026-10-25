import { Module } from '@nestjs/common';
import { PurgeService } from './purge.service';
import { ReconcileService } from './reconcile.service';

@Module({
  providers: [PurgeService, ReconcileService],
  exports: [PurgeService, ReconcileService],
})
export class RetentionModule {}
