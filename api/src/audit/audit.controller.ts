import { Controller, Get, Inject, Query } from '@nestjs/common';
import { AuditQuerySchema, type AuditQuery, type AuditQueryResponse } from '@hares/contract';
import { RequireCapability } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditQueryService } from './audit.query';

/** `GET /api/admin/audit`: the audit trail, System Admin only (WEB-FR-051). Read-only. */
@Controller('admin/audit')
export class AuditController {
  constructor(@Inject(AuditQueryService) private readonly query: AuditQueryService) {}

  @RequireCapability('AUDIT_VIEW')
  @Get()
  list(@Query(new ZodValidationPipe(AuditQuerySchema)) q: AuditQuery): Promise<AuditQueryResponse> {
    return this.query.list(q);
  }
}
