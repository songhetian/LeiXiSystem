import request from '@/lib/request';

// ========== 报表 ==========

export interface DeptAttendance {
  id: number;
  name: string;
  employeeCount: number;
  totalWorkDays: string;
  totalLateCount: number;
  totalEarlyCount: number;
  totalAbsentDays: string;
  totalOvertimeHours: string;
}

export interface DeptLaborCost {
  id: number;
  name: string;
  totalEmployees: number;
  totalAmount: string;
}

export interface AttendanceMonthlyResult {
  code: number;
  message?: string;
  data?: {
    summary: {
      totalEmployees: number;
      totalWorkDays: string;
      totalLateCount: number;
      totalEarlyCount: number;
      totalAbsentDays: string;
      totalOvertimeHours: string;
    };
    departments: DeptAttendance[];
  };
}

export interface LaborCostResult {
  code: number;
  message?: string;
  data?: {
    summary: {
      totalEmployees: number;
      totalBaseSalary: string;
      totalOvertimePay: string;
      totalDeduction: string;
      totalAmount: string;
    };
    departments: DeptLaborCost[];
  };
}

export interface ExportTask {
  id: number;
  type: string;
  format: string;
  month?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string | null;
  downloadUrl?: string | null;
  errorMsg?: string | null;
  /** 已重试次数 / 上限：用户需要知道还能重试几次 */
  retryCount?: number;
  maxRetries?: number;
  createdAt: string;
}

export const reportsApi = {
  getAttendanceMonthly(month: string): Promise<AttendanceMonthlyResult> {
    return request.get('/reports/attendance-monthly', { params: { month } });
  },
  getLaborCost(month: string): Promise<LaborCostResult> {
    return request.get('/reports/labor-cost', { params: { month } });
  },
  getEmployeeStructure(): Promise<{ code: number; message?: string; data?: any }> {
    return request.get('/reports/employee-structure');
  },
  createExportTask(data: { type: string; format: string; month: string }): Promise<{ code: number; message?: string; data?: { id: number } }> {
    return request.post('/reports/export', data);
  },
  listExportTasks(): Promise<{ code: number; message?: string; data?: { list: ExportTask[]; total: number } }> {
    return request.get('/reports/export/tasks');
  },
  /** 重试失败的导出任务（后端只允许 failed → pending，且会重置失败原因） */
  retryExportTask(
    id: number,
  ): Promise<{ code: number; message?: string; data?: { taskId: number; status: string } }> {
    return request.post(`/reports/export/${id}/retry`);
  },
  /** 员工列表导出下载地址（cookie 鉴权，可直接新窗口打开） */
  employeeListExportUrl(format: 'xlsx' | 'csv' = 'xlsx'): string {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
    return `${base}/reports/employee-list/export?format=${format}`;
  },
  /** 导出任务下载地址（同样走 cookie 鉴权，可新窗口直接打开） */
  exportTaskDownloadUrl(id: number): string {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
    return `${base}/reports/export/${id}/download`;
  },
};
