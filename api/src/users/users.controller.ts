import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApproveUserRequestSchema,
  AssignRoleRequestSchema,
  ChangeDepartmentRequestSchema,
  PendingListQuerySchema,
  ReactivateUserRequestSchema,
  RejectUserRequestSchema,
  RevokeSystemAdminRequestSchema,
  UserListQuerySchema,
  UserStatusUpdateRequestSchema,
  UuidParamSchema,
  type AdminUserResponse,
  type ApproveUserRequest,
  type AssignRoleRequest,
  type ChangeDepartmentRequest,
  type PendingListQuery,
  type ProfileResponse,
  type ReactivateUserRequest,
  type RevokeSystemAdminRequest,
  type UserListQuery,
  type UserListResponse,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { RequireCapability } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

const idPipe = new ZodValidationPipe(UuidParamSchema);
/** Actions without fields accept no body or `{}` and nothing else. */
const emptyBody = new ZodValidationPipe(UserStatusUpdateRequestSchema.optional());

/** `/api/profile` (WEB-FR-057): any signed-in user, own data only. */
@Controller('profile')
export class ProfileController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @RequireCapability('PROFILE_VIEW')
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ProfileResponse> {
    return this.users.profile(user.id);
  }
}

/** `/api/admin/users`: the capability on each route comes from the matrix. */
@Controller('admin/users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @RequireCapability('USERS_LIST')
  @Get()
  list(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(UserListQuerySchema)) query: UserListQuery,
  ): Promise<UserListResponse> {
    return this.users.list(actor, query);
  }

  @RequireCapability('USERS_APPROVE')
  @Get('pending')
  pending(@Query(new ZodValidationPipe(PendingListQuerySchema)) query: PendingListQuery): Promise<UserListResponse> {
    return this.users.pending(query);
  }

  @RequireCapability('USERS_APPROVE')
  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(ApproveUserRequestSchema)) body: ApproveUserRequest,
  ): Promise<AdminUserResponse> {
    return this.users.approve(actor, id, body);
  }

  @RequireCapability('USERS_APPROVE')
  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body(new ZodValidationPipe(RejectUserRequestSchema.optional())) _body: unknown,
  ): Promise<AdminUserResponse> {
    return this.users.reject(actor, id);
  }

  @RequireCapability('USERS_APPROVE')
  @Post(':id/reopen')
  @HttpCode(200)
  reopen(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body(emptyBody) _body: unknown,
  ): Promise<AdminUserResponse> {
    return this.users.reopen(actor, id);
  }

  @RequireCapability('USERS_DEACTIVATE')
  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body(emptyBody) _body: unknown,
  ): Promise<AdminUserResponse> {
    return this.users.deactivate(actor, id);
  }

  @RequireCapability('USERS_REACTIVATE')
  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(ReactivateUserRequestSchema.optional())) body: ReactivateUserRequest | undefined,
  ): Promise<AdminUserResponse> {
    return this.users.reactivate(actor, id, body?.department_id);
  }

  @RequireCapability('USERS_ASSIGN')
  @Patch(':id/role')
  changeRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(AssignRoleRequestSchema)) body: AssignRoleRequest,
  ): Promise<AdminUserResponse> {
    return this.users.changeRole(actor, id, body.role);
  }

  @RequireCapability('USERS_ASSIGN')
  @Patch(':id/department')
  changeDepartment(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(ChangeDepartmentRequestSchema)) body: ChangeDepartmentRequest,
  ): Promise<AdminUserResponse> {
    return this.users.changeDepartment(actor, id, body.department_id);
  }

  @RequireCapability('SYSTEM_ADMIN_GRANT')
  @Post(':id/grant-system-admin')
  @HttpCode(200)
  grant(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body(emptyBody) _body: unknown,
  ): Promise<AdminUserResponse> {
    return this.users.grantSystemAdmin(actor, id);
  }

  @RequireCapability('SYSTEM_ADMIN_GRANT')
  @Post(':id/revoke-system-admin')
  @HttpCode(200)
  revoke(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(new ZodValidationPipe(RevokeSystemAdminRequestSchema)) body: RevokeSystemAdminRequest,
  ): Promise<AdminUserResponse> {
    return this.users.revokeSystemAdmin(actor, id, body.role, body.department_id);
  }
}
