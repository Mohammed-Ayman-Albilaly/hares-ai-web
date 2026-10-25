import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  AnalyticsQuerySchema,
  type AnalyticsQuery,
  type DashboardSummaryResponse,
  type DashboardTimeseriesResponse,
  type TopRiskyUsersResponse,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { RequireCapability } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';

const queryPipe = new ZodValidationPipe(AnalyticsQuerySchema);

/**
 * `/api/dashboard/*`: the capability on each route decides who may call it
 * (own: every role; department: Department Admin and System Admin; org: System
 * Admin). Scope is taken from the signed-in user, never from the request.
 */
@Controller('dashboard')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @RequireCapability('OWN_DASHBOARD_VIEW')
  @Get('mine/summary')
  mineSummary(@CurrentUser() actor: AuthUser, @Query(queryPipe) q: AnalyticsQuery): Promise<DashboardSummaryResponse> {
    return this.analytics.summaryOwn(actor, q);
  }

  @RequireCapability('OWN_DASHBOARD_VIEW')
  @Get('mine/timeseries')
  mineTimeseries(@CurrentUser() actor: AuthUser, @Query(queryPipe) q: AnalyticsQuery): Promise<DashboardTimeseriesResponse> {
    return this.analytics.timeseriesOwn(actor, q);
  }

  @RequireCapability('DEPT_DASHBOARD_VIEW')
  @Get('department/summary')
  departmentSummary(@CurrentUser() actor: AuthUser, @Query(queryPipe) q: AnalyticsQuery): Promise<DashboardSummaryResponse> {
    return this.analytics.summaryDepartment(actor, q);
  }

  @RequireCapability('DEPT_DASHBOARD_VIEW')
  @Get('department/timeseries')
  departmentTimeseries(@CurrentUser() actor: AuthUser, @Query(queryPipe) q: AnalyticsQuery): Promise<DashboardTimeseriesResponse> {
    return this.analytics.timeseriesDepartment(actor, q);
  }

  @RequireCapability('DEPT_DASHBOARD_VIEW')
  @Get('department/top-users')
  departmentTopUsers(@CurrentUser() actor: AuthUser, @Query(queryPipe) q: AnalyticsQuery): Promise<TopRiskyUsersResponse> {
    return this.analytics.topUsersDepartment(actor, q);
  }

  @RequireCapability('ORG_DASHBOARD_VIEW')
  @Get('org/summary')
  orgSummary(@Query(queryPipe) q: AnalyticsQuery): Promise<DashboardSummaryResponse> {
    return this.analytics.summaryOrg(q);
  }

  @RequireCapability('ORG_DASHBOARD_VIEW')
  @Get('org/timeseries')
  orgTimeseries(@Query(queryPipe) q: AnalyticsQuery): Promise<DashboardTimeseriesResponse> {
    return this.analytics.timeseriesOrg(q);
  }
}
