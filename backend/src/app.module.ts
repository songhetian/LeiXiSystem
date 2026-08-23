import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { configModuleOptions } from './common/config/config.options';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { ThrottlerStorageRedis } from './common/redis/throttler-storage-redis.service';
import { PrismaModule } from './prisma/prisma.module';
import { DataScopeModule } from './common/data-scope.module';
import { CommonModule } from './common/common.module';
import { LockModule } from './common/lock.module';
import { PermissionCacheModule } from './common/permission-cache.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { EmployeesModule } from './employees/employees.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PayrollModule } from './payroll/payroll.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { SystemModule } from './system/system.module';
import { ApprovalModule } from './approval/approval.module';
import { ReimbursementModule } from './reimbursement/reimbursement.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationModule } from './notification/notification.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PerformanceModule } from './performance/performance.module';
import { FinanceModule } from './finance/finance.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => [
        {
          ttl: 60000,
          limit: 60,
          storage: new ThrottlerStorageRedis(redis),
        },
      ],
    }),
    PrismaModule,
    DataScopeModule,
    CommonModule,
    RedisModule,
    LockModule,
    PermissionCacheModule,
    AuthModule,
    EmployeesModule,
    AttendanceModule,
    PayrollModule,
    KnowledgeModule,
    SystemModule,
    ApprovalModule,
    ReimbursementModule,
    ReportsModule,
    NotificationModule,
    RealtimeModule,
    SettingsModule,
    DashboardModule,
    PerformanceModule,
    FinanceModule,
    HelpdeskModule,
  ],
  controllers: [HealthController],
  providers: [
    // 全局请求限流：60 次/分钟
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
