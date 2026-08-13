import request from '@/lib/request';

// ========== 考勤日报 ==========

export interface DailyRecord {
  id: number;
  employeeId: number;
  employeeNo: string;
  employeeName: string;
  departmentName: string;
  date: string;
  shiftName: string;
  checkIn?: string;
  checkOut?: string;
  workHours?: number;
  status: 'normal' | 'abnormal' | 'leave' | 'absent';
  abnormalType?: string | null;
}

export interface DailyListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  employeeNo?: string;
  departmentId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface DailyListResult {
  code: number;
  message?: string;
  data?: {
    list: DailyRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface RecalcParams {
  employeeId?: number;
  startDate: string;
  endDate: string;
}

export interface RecalcResult {
  code: number;
  message?: string;
  data?: {
    updated: number;
  };
}

// ========== 考勤月报 ==========

export interface MonthlyRecord {
  id: number;
  employeeId: number;
  employeeNo: string;
  employeeName: string;
  departmentName: string;
  month: string;
  workDays: number;
  normalDays: number;
  abnormalDays: number;
  leaveDays: number;
  absentDays: number;
  overtimeHours: number;
  totalWorkHours: number;
}

export interface MonthlyListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  departmentId?: number;
  month?: string;
}

export interface MonthlyListResult {
  code: number;
  message?: string;
  data?: {
    list: MonthlyRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// ========== 班次管理 ==========

export interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  isNextDay: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftCreateDto {
  name: string;
  startTime: string;
  endTime: string;
  isNextDay: boolean;
}

export interface ShiftUpdateDto {
  name?: string;
  startTime?: string;
  endTime?: string;
  isNextDay?: boolean;
}

export interface ShiftListResult {
  code: number;
  message?: string;
  data?: {
    list: Shift[];
    total: number;
  };
}

export interface ShiftResult {
  code: number;
  message?: string;
  data?: Shift;
}

// ========== 排班管理 ==========

export interface Schedule {
  id: number;
  employeeId: number;
  shiftId: number;
  workDate: string;
  employee?: {
    id: number;
    employeeNo: string;
    name: string;
  };
  shift?: Shift;
}

export interface ScheduleCreateDto {
  employeeId: number;
  shiftId: number;
  workDate: string;
}

export interface ScheduleUpdateDto {
  employeeId?: number;
  shiftId?: number;
  workDate?: string;
}

export interface ScheduleBatchDto {
  items: ScheduleCreateDto[];
}

export interface ScheduleListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  startDate?: string;
  endDate?: string;
}

export interface ScheduleListResult {
  code: number;
  message?: string;
  data?: {
    list: Schedule[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface ScheduleResult {
  code: number;
  message?: string;
  data?: Schedule;
}

export interface BatchResult {
  code: number;
  message?: string;
  data?: {
    count: number;
  };
}

// ========== 打卡设备管理 ==========

export interface PunchDevice {
  id: number;
  name: string;
  deviceNo: string;
  ipAddress: string;
  port: number;
  apiKey?: string;
  enabled: boolean;
  lastSyncTime?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PunchDeviceCreateDto {
  name: string;
  deviceNo: string;
  ipAddress: string;
  port?: number;
  apiKey?: string;
  enabled?: boolean;
}

export interface PunchDeviceUpdateDto {
  name?: string;
  deviceNo?: string;
  ipAddress?: string;
  port?: number;
  apiKey?: string;
  enabled?: boolean;
}

export interface PunchDeviceListResult {
  code: number;
  message?: string;
  data?: {
    list: PunchDevice[];
    total: number;
  };
}

export interface PunchDeviceResult {
  code: number;
  message?: string;
  data?: PunchDevice;
}

// ========== 休假额度 ==========

export interface VacationType {
  id: number;
  code: string;
  name: string;
}

export interface VacationBalance {
  id: number;
  employeeId: number;
  vacationTypeId: number;
  year: number;
  totalDays: number;
  usedDays: number;
  vacationType: VacationType;
}

export interface BalanceListResult {
  code: number;
  message?: string;
  data?: {
    list: VacationBalance[];
    total: number;
  };
}

// ========== 请假记录 ==========

export interface LeaveRecord {
  id: number;
  employeeId: number;
  vacationTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approving' | 'approved' | 'rejected' | 'cancelled';
  vacationType?: VacationType;
  employee?: {
    id: number;
    employeeNo: string;
    name: string;
  };
}

export interface LeaveCreateDto {
  employeeId: number;
  vacationTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

export interface LeaveListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  status?: string;
}

export interface LeaveListResult {
  code: number;
  message?: string;
  data?: {
    list: LeaveRecord[];
    total: number;
  };
}

// ========== 加班记录 ==========

export interface OvertimeRecord {
  id: number;
  employeeId: number;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason?: string;
  status: 'pending' | 'approving' | 'approved' | 'rejected' | 'cancelled';
  employee?: {
    id: number;
    employeeNo: string;
    name: string;
  };
}

export interface OvertimeCreateDto {
  employeeId: number;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason?: string;
}

export interface OvertimeListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  status?: string;
}

export interface OvertimeListResult {
  code: number;
  message?: string;
  data?: {
    list: OvertimeRecord[];
    total: number;
  };
}

// ========== API ==========

export const attendanceApi = {
  // 日报
  getDailyList(params: DailyListParams = {}): Promise<DailyListResult> {
    return request.get('/attendance/daily', { params });
  },
  recalcDaily(params: RecalcParams): Promise<RecalcResult> {
    return request.post('/attendance/daily/recalc', params);
  },
  // 月报
  getMonthlyList(params: MonthlyListParams = {}): Promise<MonthlyListResult> {
    return request.get('/attendance/monthly', { params });
  },
  // 班次
  getShiftList(): Promise<ShiftListResult> {
    return request.get('/shifts');
  },
  createShift(data: ShiftCreateDto): Promise<ShiftResult> {
    return request.post('/shifts', data);
  },
  updateShift(id: number, data: ShiftUpdateDto): Promise<ShiftResult> {
    return request.put(`/shifts/${id}`, data);
  },
  deleteShift(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/shifts/${id}`);
  },
  // 排班
  getScheduleList(params: ScheduleListParams = {}): Promise<ScheduleListResult> {
    return request.get('/schedules', { params });
  },
  createSchedule(data: ScheduleCreateDto): Promise<ScheduleResult> {
    return request.post('/schedules', data);
  },
  batchCreateSchedule(data: ScheduleBatchDto): Promise<BatchResult> {
    return request.post('/schedules/batch', data);
  },
  updateSchedule(id: number, data: ScheduleUpdateDto): Promise<ScheduleResult> {
    return request.put(`/schedules/${id}`, data);
  },
  deleteSchedule(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/schedules/${id}`);
  },
  // 打卡设备
  getPunchDeviceList(): Promise<PunchDeviceListResult> {
    return request.get('/attendance/punch/devices');
  },
  getPunchDevice(id: number): Promise<PunchDeviceResult> {
    return request.get(`/attendance/punch/devices/${id}`);
  },
  createPunchDevice(data: PunchDeviceCreateDto): Promise<PunchDeviceResult> {
    return request.post('/attendance/punch/devices', data);
  },
  updatePunchDevice(id: number, data: PunchDeviceUpdateDto): Promise<PunchDeviceResult> {
    return request.put(`/attendance/punch/devices/${id}`, data);
  },
  deletePunchDevice(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/attendance/punch/devices/${id}`);
  },
  // 休假额度
  getBalanceList(params?: { employeeId?: number; year?: number }): Promise<BalanceListResult> {
    return request.get('/vacation/balances', { params });
  },
  getMyBalances(year?: number): Promise<{ code: number; message?: string; data?: VacationBalance[] }> {
    return request.get('/vacation/balances/mine', { params: { year } });
  },
  // 请假
  getLeaveList(params: LeaveListParams = {}): Promise<LeaveListResult> {
    return request.get('/leave-records', { params });
  },
  createLeave(data: LeaveCreateDto): Promise<{ code: number; message?: string; data?: LeaveRecord }> {
    return request.post('/leave-records', data);
  },
  submitLeave(id: number): Promise<{ code: number; message?: string }> {
    return request.post(`/leave-records/${id}/submit`);
  },
  // 加班
  getOvertimeList(params: OvertimeListParams = {}): Promise<OvertimeListResult> {
    return request.get('/overtime-records', { params });
  },
  createOvertime(data: OvertimeCreateDto): Promise<{ code: number; message?: string; data?: OvertimeRecord }> {
    return request.post('/overtime-records', data);
  },
  submitOvertime(id: number): Promise<{ code: number; message?: string }> {
    return request.post(`/overtime-records/${id}/submit`);
  },
};
