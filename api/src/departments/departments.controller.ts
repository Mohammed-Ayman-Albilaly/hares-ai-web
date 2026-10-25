import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  CreateDepartmentRequestSchema,
  DeactivateDepartmentRequestSchema,
  RenameDepartmentRequestSchema,
  UuidParamSchema,
  type CreateDepartmentRequest,
  type DepartmentListResponse,
  type DepartmentResponse,
  type RenameDepartmentRequest,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { RequireCapability } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DepartmentsService } from './departments.service';

/** `/api/admin/departments` — System Admin only (decision 14). */
@RequireCapability('DEPARTMENTS_MANAGE')
@Controller('admin/departments')
export class DepartmentsController {
  constructor(@Inject(DepartmentsService) private readonly departments: DepartmentsService) {}

  @Get()
  async list(): Promise<DepartmentListResponse> {
    return { items: await this.departments.list() };
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateDepartmentRequestSchema)) body: CreateDepartmentRequest,
  ): Promise<DepartmentResponse> {
    return this.departments.create(user.id, body.name);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(UuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(RenameDepartmentRequestSchema)) body: RenameDepartmentRequest,
  ): Promise<DepartmentResponse> {
    return this.departments.rename(user.id, id, body.name);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(UuidParamSchema)) id: string,
    // The body must be empty or `{}`; the pipe rejects anything else.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body(new ZodValidationPipe(DeactivateDepartmentRequestSchema.optional())) _body: unknown,
  ): Promise<DepartmentResponse> {
    return this.departments.deactivate(user.id, id);
  }
}
