import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalGroupController } from './approval-group.controller';
import { ApprovalGroupService } from './approval-group.service';

@Module({
  controllers: [ApprovalController, ApprovalGroupController],
  providers: [ApprovalService, ApprovalGroupService],
  exports: [ApprovalService, ApprovalGroupService],
})
export class ApprovalModule {}
