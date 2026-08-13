import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SystemController } from './system.controller';
import { BroadcastPublicController } from './broadcast-public.controller';
import { OperationLogService } from './operation-log.service';
import { BroadcastService } from './broadcast.service';
import { SystemUserService } from './system-user.service';
import { OperationLogInterceptor } from './operation-log.interceptor';

@Module({
  controllers: [SystemController, BroadcastPublicController],
  providers: [
    OperationLogService,
    BroadcastService,
    SystemUserService,
    {
      provide: APP_INTERCEPTOR,
      useClass: OperationLogInterceptor,
    },
  ],
  exports: [OperationLogService, BroadcastService, SystemUserService],
})
export class SystemModule {}
