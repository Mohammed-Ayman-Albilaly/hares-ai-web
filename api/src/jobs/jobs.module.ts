import { Module } from '@nestjs/common';
import { RetentionModule } from '../retention/retention.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [RetentionModule],
  providers: [JobsService],
})
export class JobsModule {}
