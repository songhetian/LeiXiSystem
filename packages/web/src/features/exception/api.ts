import type { AttendanceExceptionView, AttendanceExceptionType, AttendanceExceptionStatus } from '@leixi/shared';
import { api } from '../../lib/api';

export interface ExceptionList {
  exceptions: AttendanceExceptionView[];
}

export interface ScanResult {
  created: number;
  updated: number;
}

export const AT_EXCEPTION_TYPES: { value: AttendanceExceptionType; label: string }[] = [
  { value: 'late', label: '迟到' },
  { value: 'early_leave', label: '早退' },
  { value: 'missing_punch', label: '缺卡' },
  { value: 'absent', label: '缺勤' },
];

export const AT_EXCEPTION_STATUS: { value: AttendanceExceptionStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'confirmed', label: '已确认' },
  { value: 'dismissed', label: '已驳回' },
];

export const atExceptionApi = {
  /** 拉取当前作用域内的考勤异常（后端按部门隔离过滤） */
  async list(filters: { status?: string; type?: string } = {}): Promise<ExceptionList> {
    const q = new URLSearchParams();
    if (filters.status) q.set('status', filters.status);
    if (filters.type) q.set('type', filters.type);
    const qs = q.toString();
    return api<ExceptionList>(`/api/attendance/exceptions${qs ? `?${qs}` : ''}`);
  },
  /** 扫描判定并落库指定日期区间的异常 */
  async scan(startDate: string, endDate: string): Promise<ScanResult> {
    return api<ScanResult>('/api/attendance/exceptions/scan', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    });
  },
  /** 人工确认/驳回：confirmed / dismissed，可填备注 */
  async setStatus(id: number, status: 'confirmed' | 'dismissed', remark?: string): Promise<null> {
    return api<null>(`/api/attendance/exceptions/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, remark }),
    });
  },
};