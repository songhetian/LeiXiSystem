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
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
