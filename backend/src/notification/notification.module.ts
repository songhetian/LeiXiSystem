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
    // 只读策略边界：审批流判断「某节点到达到底要不要发通知」时注入该 token
    { provide: 'NOTIFICATION_POLICY', useExisting: NotificationSettingService },
  ],
  exports: [NotificationService, 'NOTIFICATION_CLIENT', 'NOTIFICATION_POLICY'],
})
export class NotificationModule {}
