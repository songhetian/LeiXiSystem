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
  createdAt: string;
}

export const reportsApi = {
  getAttendanceMonthly(month: string): Promise<AttendanceMonthlyResult> {
    return request.get('/reports/attendance-monthly', { params: { month } });
  },
  getLaborCost(month: string): Promise<LaborCostResult> {
    return request.get('/reports/labor-cost', { params: { month } });
  },
  createExportTask(data: { type: string; format: string; month: string }): Promise<{ code: number; message?: string; data?: { id: number } }> {
    return request.post('/reports/export', data);
  },
  listExportTasks(): Promise<{ code: number; message?: string; data?: { list: ExportTask[]; total: number } }> {
    return request.get('/reports/export/tasks');
  },
};
