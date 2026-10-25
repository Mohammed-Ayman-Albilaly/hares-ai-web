import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditQueryService } from './audit.query';
import { AuditService } from './audit.service';

/** Global so every admin module can write audit entries in its transactions. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService],
  exports: [AuditService],
})
export class AuditModule {}
