import { Module } from '@nestjs/common';
import { AdminLogsController, OwnLogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  controllers: [OwnLogsController, AdminLogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
