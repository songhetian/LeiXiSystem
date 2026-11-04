import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReportsService } from './reports.service';
import { withEventRetry } from '../common/event-retry.util';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

/** 报表缓存域：与 `clear*ReportsCache` 方法一一对应 */
type ReportCacheDomain = 'attendance' | 'employee';

/**
 * 业务编码 → 需要失效的报表缓存域。
 *
 * 此前是三个 handler 里各写一遍 `if (leave || overtime || punch_makeup)` 的硬编码，
 * 新增业务编码时容易漏登记：`transfer` 审批通过会改员工部门、`attendance_appeal`
 * 通过会修正考勤日报，二者的缓存却一直没清，报表脏到 TTL 到期才恢复。
 * 审批域（approval-efficiency）对所有业务无条件失效，不在此表。
 */
const REPORT_CACHE_DOMAINS: Record<string, ReportCacheDomain[]> = {
  leave: ['attendance'],
  overtime: ['attendance'],
  punch_makeup: ['attendance'],
  attendance_appeal: ['attendance'],
  probation: ['employee'],
  onboarding: ['employee'],
  resignation: ['employee'],
  transfer: ['employee'],
  reward_punishment: ['employee'],
  cert_request: ['employee'],
};

@Injectable()
export class ReportsCacheListener {
  private readonly logger = new Logger(ReportsCacheListener.name);

  constructor(private readonly reportsService: ReportsService) {}

  @OnEvent('approval.approved')
  async handleApprovalApproved(payload: any) {
    await withEventRetry(
      async () => {
        await this.clearReportsForWorkflow(payload?.workflowCode);
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
        await this.clearReportsForWorkflow(payload?.workflowCode);
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
        await this.clearReportsForWorkflow(payload?.workflowCode);
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

  /**
   * 审批状态变化后按业务编码清理报表缓存。
   * 未登记的编码只清审批域，并留一条 debug 日志 —— 静默跳过是「新增业务后
   * 报表变脏且无人知情」的根因。
   */
  private async clearReportsForWorkflow(workflowCode?: string) {
    await this.clearApprovalReportsCache();
    if (!workflowCode) return;

    const domains = REPORT_CACHE_DOMAINS[workflowCode];
    if (!domains) {
      this.logger.debug(`业务编码 ${workflowCode} 未登记报表缓存域，仅清理审批报表`);
      return;
    }
    if (domains.includes('attendance')) await this.clearAttendanceReportsCache();
    if (domains.includes('employee')) await this.clearEmployeeReportsCache();
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
