import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReportsService } from './reports.service';
import { withEventRetry } from '../common/event-retry.util';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

@Injectable()
export class ReportsCacheListener {
  private readonly logger = new Logger(ReportsCacheListener.name);

  constructor(private readonly reportsService: ReportsService) {}

  @OnEvent('approval.approved')
  async handleApprovalApproved(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearApprovalReportsCache();
        const { workflowCode } = payload;
        if (workflowCode === 'leave' || workflowCode === 'overtime' || workflowCode === 'punch_makeup') {
          await this.clearAttendanceReportsCache();
        }
        if (workflowCode === 'probation' || workflowCode === 'onboarding' || workflowCode === 'resignation') {
          await this.clearEmployeeReportsCache();
        }
      },
      'approval.approved (clear report cache)',
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearApprovalReportsCache();
        const { workflowCode } = payload;
        if (workflowCode === 'leave' || workflowCode === 'overtime' || workflowCode === 'punch_makeup') {
          await this.clearAttendanceReportsCache();
        }
        if (workflowCode === 'probation' || workflowCode === 'onboarding' || workflowCode === 'resignation') {
          await this.clearEmployeeReportsCache();
        }
      },
      'approval.rejected (clear report cache)',
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.withdrawn')
  async handleApprovalWithdrawn(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearApprovalReportsCache();
        const { workflowCode } = payload;
        if (workflowCode === 'leave' || workflowCode === 'overtime' || workflowCode === 'punch_makeup') {
          await this.clearAttendanceReportsCache();
        }
        if (workflowCode === 'probation' || workflowCode === 'onboarding' || workflowCode === 'resignation') {
          await this.clearEmployeeReportsCache();
        }
      },
      'approval.withdrawn (clear report cache)',
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.resubmitted')
  async handleApprovalResubmitted(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearApprovalReportsCache();
      },
      'approval.resubmitted (clear report cache)',
      payload,
      this.logger,
    );
  }

  @OnEvent('attendance.monthly.confirmed')
  async handleAttendanceMonthlyConfirmed(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearAttendanceReportsCache();
      },
      'attendance.monthly.confirmed (clear report cache)',
      payload,
      this.logger,
    );
  }

  @OnEvent(EVENT_PAYROLL_STATUS_CHANGED)
  async handlePayrollStatusChanged(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearPayrollReportsCache();
      },
      `${EVENT_PAYROLL_STATUS_CHANGED} (clear report cache)`,
      payload,
      this.logger,
    );
  }

  private async clearEmployeeReportsCache() {
    await this.reportsService.clearReportCache('report:employee-structure:*');
    await this.reportsService.clearReportCache('report:hiring-trend:*');
    await this.reportsService.clearReportCache('report:probation-pass-rate:*');
    this.logger.log('员工相关报表缓存已清除');
  }

  private async clearAttendanceReportsCache() {
    await this.reportsService.clearReportCache('report:attendance-monthly:*');
    await this.reportsService.clearReportCache('report:attendance-abnormal:*');
    this.logger.log('考勤相关报表缓存已清除');
  }

  private async clearApprovalReportsCache() {
    await this.reportsService.clearReportCache('report:approval-efficiency:*');
    this.logger.log('审批相关报表缓存已清除');
  }

  private async clearPayrollReportsCache() {
    await this.reportsService.clearReportCache('report:labor-cost:*');
    this.logger.log('薪资相关报表缓存已清除');
  }

  async clearAllReportsCache() {
    await this.reportsService.clearReportCache('report:*');
    this.logger.log('所有报表缓存已清除');
  }
}
