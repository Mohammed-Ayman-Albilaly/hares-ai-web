import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { DepartmentsModule } from './departments/departments.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { JobsModule } from './jobs/jobs.module';
import { LogsModule } from './logs/logs.module';
import { PolicyModule } from './policy/policy.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    CommonModule,
    AuditModule,
    HealthModule,
    AuthModule,
    DepartmentsModule,
    UsersModule,
    PolicyModule,
    IngestionModule,
    LogsModule,
    AnalyticsModule,
    JobsModule,
  ],
})
export class AppModule {}
