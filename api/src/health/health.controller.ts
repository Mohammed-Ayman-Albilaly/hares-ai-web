import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthResponseSchema, type HealthResponse } from '@hares/contract';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestContext } from '../common/request-context';

const SERVICE_NAME = 'hares-api';
const SERVICE_VERSION = process.env.npm_package_version ?? '0.0.0';

/**
 * Liveness/readiness probe (`GET /api/health`).
 *
 * Returns the `HealthResponse` envelope when the process is up and the database
 * answers a trivial query; otherwise it throws `ServiceUnavailableException`
 * (503), which the global filter renders as the standard error envelope.
 *
 * PrismaService is injected with `@Inject()` because the dev runtime (tsx /
 * esbuild) does not emit `design:paramtypes`, so type-based DI is unavailable.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger('Health');

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const requestId = getRequestContext()?.request_id ?? 'unknown';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      // Log the failure server-side (no client value is included).
      this.logger.error(`health DB probe failed: ${(e as Error)?.message ?? e}`);
      throw new ServiceUnavailableException('API database is not ready.');
    }

    return HealthResponseSchema.parse({
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      request_id: requestId,
    });
  }
}
