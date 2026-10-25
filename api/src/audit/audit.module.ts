import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global so every admin module can write audit entries in its transactions. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
