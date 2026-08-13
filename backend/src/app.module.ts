import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './common/config/config.options';
import { RedisModule } from './common/redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { DataScopeModule } from './common/data-scope.module';
import { CommonModule } from './common/common.module';
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

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    DataScopeModule,
    CommonModule,
    RedisModule,
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
