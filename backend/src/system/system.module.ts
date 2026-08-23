import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SystemController } from './system.controller';
import { BroadcastPublicController } from './broadcast-public.controller';
import { OperationLogService } from './operation-log.service';
import { BroadcastService } from './broadcast.service';
import { SystemUserService } from './system-user.service';
import { DictService } from './dict.service';
import { DataCleanupService } from './data-cleanup.service';
import { OperationLogInterceptor } from './operation-log.interceptor';
import { NotificationModule } from '../notification/notification.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [NotificationModule, SettingsModule],
  controllers: [SystemController, BroadcastPublicController],
  providers: [
    OperationLogService,
    BroadcastService,
    SystemUserService,
    DictService,
    DataCleanupService,
    {
      provide: APP_INTERCEPTOR,
      useClass: OperationLogInterceptor,
    },
  ],
  exports: [OperationLogService, BroadcastService, SystemUserService, DictService, DataCleanupService],
})
export class SystemModule {}
