import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CSV_EXPORT_MAX_ROWS,
  LogExportQuerySchema,
  LogQuerySchema,
  OwnLogQuerySchema,
  UuidParamSchema,
  type LogDetail,
  type LogExportQuery,
  type LogListResponse,
  type LogQuery,
  type OwnLogQuery,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/auth.decorators';
import { RequireCapability } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CSV_BOM } from './csv';
import { LogsService } from './logs.service';

/** `GET /api/logs/mine`: the caller's own events, whatever their role. */
@Controller('logs')
export class OwnLogsController {
  constructor(@Inject(LogsService) private readonly logs: LogsService) {}

  @RequireCapability('OWN_LOGS_VIEW')
  @Get('mine')
  mine(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(OwnLogQuerySchema)) query: OwnLogQuery,
  ): Promise<LogListResponse> {
    return this.logs.own(actor, query);
  }
}

/** `/api/admin/logs`: administrators only. Scope is decided by the caller's role (System Admin: all; Department Admin: own department). */
@Controller('admin/logs')
export class AdminLogsController {
  constructor(@Inject(LogsService) private readonly logs: LogsService) {}

  @RequireCapability('DEPT_DASHBOARD_VIEW')
  @Get()
  list(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(LogQuerySchema)) query: LogQuery,
  ): Promise<LogListResponse> {
    return this.logs.admin(actor, query);
  }

  // Declared before ':log_id' so "export" is not read as an id.
  @RequireCapability('LOGS_EXPORT')
  @Get('export')
  async export(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(LogExportQuerySchema)) query: LogExportQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let closed = false;
    let started = false;
    req.on('close', () => {
      if (!res.writableEnded) closed = true;
    });
    // Headers and the BOM go out with the first chunk, i.e. only after the first
    // database query succeeded; before that an error is a normal JSON response.
    const write = (chunk: string): Promise<void> =>
      new Promise((resolve) => {
        if (closed || res.destroyed) return resolve();
        let out = chunk;
        if (!started) {
          started = true;
          res.status(200);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${stamp}.csv"`);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Export-Row-Limit', String(CSV_EXPORT_MAX_ROWS));
          out = CSV_BOM + chunk;
        }
        res.write(out, () => resolve());
      });

    try {
      await this.logs.exportCsv(actor, query, write, () => closed);
      res.end();
    } catch (e) {
      // Nothing sent yet: let the global filter answer with a JSON error.
      if (!started) throw e;
      // Part of the file is already out: abort the download so the client sees a
      // failed transfer instead of a silently truncated "complete" file.
      res.destroy(e instanceof Error ? e : undefined);
    }
  }

  @RequireCapability('DEPT_DASHBOARD_VIEW')
  @Get(':log_id')
  detail(
    @CurrentUser() actor: AuthUser,
    @Param('log_id', new ZodValidationPipe(UuidParamSchema)) logId: string,
  ): Promise<LogDetail> {
    return this.logs.detail(actor, logId);
  }
}
