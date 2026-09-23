import type { AttendanceView, AttendanceStatsRow } from '@leixi/shared';
import { api } from '../../lib/api';

export interface AttendanceList {
  attendance: AttendanceView[];
}

export interface AttendanceStats {
  stats: AttendanceStatsRow[];
}

export interface CreateAttendanceInput {
  date: string; // YYYY-MM-DD
  checkIn?: string | null; // HH:mm
  checkOut?: string | null; // HH:mm
  note?: string;
}

export const attendanceApi = {
  /** 拉取当前用户可见作用域内的打卡记录（后端按部门隔离过滤） */
  async getAttendance(): Promise<AttendanceList> {
    return api<AttendanceList>('/api/attendance');
  },
  /** 考勤统计报表：按员工×月份聚合（后端 scope 隔离） */
  async getAttendanceStats(month: string): Promise<AttendanceStats> {
    return api<AttendanceStats>(`/api/attendance/stats?month=${encodeURIComponent(month)}`);
  },
  /** 打卡：departmentId 由后端强制取自当前用户 */
  async createAttendance(data: CreateAttendanceInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};