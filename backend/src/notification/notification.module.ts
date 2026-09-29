import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationSettingController } from './notification-setting.controller';
import { NotificationSettingService } from './notification-setting.service';
import {
  InAppNotificationProvider,
  EmailNotificationProvider,
  SmsNotificationProvider,
  NOTIFICATION_PROVIDERS,
} from './channels';

const notificationProviders = [
  InAppNotificationProvider,
  EmailNotificationProvider,
  SmsNotificationProvider,
];

@Module({
  controllers: [NotificationController, NotificationSettingController],
  providers: [
    NotificationService,
    NotificationSettingService,
    ...notificationProviders,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (...providers) => providers,
      inject: notificationProviders,
    },
    // 跨模块投递边界（ADR-0013）：其他业务模块只允许注入该 token，禁止 import NotificationService
    { provide: 'NOTIFICATION_CLIENT', useExisting: NotificationService },
  ],
  exports: [NotificationService, 'NOTIFICATION_CLIENT'],
})
export class NotificationModule {}
