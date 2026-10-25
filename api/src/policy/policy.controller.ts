import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  CategoryCodeSchema,
  CustomRuleRequestSchema,
  PolicyCategoryActionRequestSchema,
  UuidParamSchema,
  type CategoryCode,
  type CustomRuleListResponse,
  type CustomRuleRequest,
  type CustomRuleResponse,
  type DepartmentPolicyResponse,
  type OrgPolicyResponse,
  type PolicyBundleResponse,
  type PolicyCategoryActionRequest,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { RequireCapability } from '../common/decorators/roles.decorator';
import { ExtensionOnly } from '../common/guards/extension.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PolicyService } from './policy.service';

const idPipe = new ZodValidationPipe(UuidParamSchema);
const categoryPipe = new ZodValidationPipe(CategoryCodeSchema);
const actionBody = new ZodValidationPipe(PolicyCategoryActionRequestSchema);
const ruleBody = new ZodValidationPipe(CustomRuleRequestSchema);

/** `/api/admin/policy`: view for both admin roles (a Department Admin: own department only), edit for the System Admin. */
@Controller('admin/policy')
export class PolicyController {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {}

  @RequireCapability('POLICY_VIEW')
  @Get('org')
  org(): Promise<OrgPolicyResponse> {
    return this.policy.orgPolicy();
  }

  @RequireCapability('POLICY_MANAGE')
  @Put('org/:category')
  setOrg(
    @CurrentUser() actor: AuthUser,
    @Param('category', categoryPipe) category: CategoryCode,
    @Body(actionBody) body: PolicyCategoryActionRequest,
  ): Promise<OrgPolicyResponse> {
    return this.policy.setOrg(actor, category, body);
  }

  @RequireCapability('POLICY_VIEW')
  @Get('departments/:id')
  department(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
  ): Promise<DepartmentPolicyResponse> {
    return this.policy.departmentPolicy(actor, id);
  }

  @RequireCapability('POLICY_MANAGE')
  @Put('departments/:id/:category')
  setDepartment(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Param('category', categoryPipe) category: CategoryCode,
    @Body(actionBody) body: PolicyCategoryActionRequest,
  ): Promise<DepartmentPolicyResponse> {
    return this.policy.setDepartment(actor, id, category, body);
  }

  @RequireCapability('POLICY_MANAGE')
  @Delete('departments/:id/:category')
  clearDepartment(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Param('category', categoryPipe) category: CategoryCode,
  ): Promise<DepartmentPolicyResponse> {
    return this.policy.clearDepartment(actor, id, category);
  }
}

/** `/api/admin/rules`: custom detection rules. */
@Controller('admin/rules')
export class RulesController {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {}

  @RequireCapability('RULES_VIEW')
  @Get()
  list(@CurrentUser() actor: AuthUser): Promise<CustomRuleListResponse> {
    return this.policy.listRules(actor);
  }

  @RequireCapability('RULES_MANAGE')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post()
  @HttpCode(201)
  create(@CurrentUser() actor: AuthUser, @Body(ruleBody) body: CustomRuleRequest): Promise<CustomRuleResponse> {
    return this.policy.createRule(actor, body);
  }

  @RequireCapability('RULES_MANAGE')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Put(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', idPipe) id: string,
    @Body(ruleBody) body: CustomRuleRequest,
  ): Promise<CustomRuleResponse> {
    return this.policy.updateRule(actor, id, body);
  }
}

/**
 * `GET /api/policy/bundle` for the extension (WEB-FR-042/044/070). `ETag` +
 * `If-None-Match`: an unchanged version answers 304 without building the bundle.
 * `Cache-Control: private` keeps shared caches from serving another
 * department's bundle. The body carries no auth material.
 */
@ExtensionOnly()
@Controller('policy')
export class BundleController {
  constructor(@Inject(PolicyService) private readonly policy: PolicyService) {}

  @Get('bundle')
  @Header('Cache-Control', 'private')
  async bundle(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PolicyBundleResponse | undefined> {
    const current = await this.policy.etagFor(user.departmentId);
    if (matchesETag(req.headers['if-none-match'], current.etag)) {
      res.status(304).setHeader('ETag', current.etag);
      return undefined;
    }
    const { body, etag } = await this.policy.bundle(user.departmentId);
    res.setHeader('ETag', etag);
    return body;
  }
}

/** True when any entry of the If-None-Match header equals the ETag (weak prefix allowed). */
function matchesETag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header
    .split(',')
    .map((v) => v.trim().replace(/^W\//, ''))
    .some((v) => v === etag || v === '*');
}
