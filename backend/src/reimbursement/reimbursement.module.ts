import { Module } from '@nestjs/common';
import { ReimbursementController } from './reimbursement.controller';
import { ReimbursementService } from './reimbursement.service';
import { ReimbursementListener } from './reimbursement.listener';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [ApprovalModule],
  controllers: [ReimbursementController],
  providers: [ReimbursementService, ReimbursementListener],
  exports: [ReimbursementService],
})
export class ReimbursementModule {}
