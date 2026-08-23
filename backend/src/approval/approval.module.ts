import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalGroupController } from './approval-group.controller';
import { ApprovalGroupService } from './approval-group.service';
import { ApprovalClientImpl } from './approval-client.impl';
import { ApprovalReconcilerService } from './approval-reconciler.service';
import { ApprovalReminderService } from './approval-reminder.service';
import { NotificationModule } from '../notification/notification.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [NotificationModule, SettingsModule],
  controllers: [ApprovalController, ApprovalGroupController],
  providers: [
    ApprovalService,
    ApprovalGroupService,
    ApprovalClientImpl,
    ApprovalReconcilerService,
    ApprovalReminderService,
    { provide: 'APPROVAL_CLIENT', useExisting: ApprovalClientImpl },
  ],
  exports: [
    ApprovalService,
    ApprovalGroupService,
    ApprovalClientImpl,
    'APPROVAL_CLIENT',
  ],
})
export class ApprovalModule {}
