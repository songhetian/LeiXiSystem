import request from '@/lib/request';

// ========== 考勤申请聚合审计（批次六） ==========

export interface AttendanceAuditRow {
  recordType: 'leave' | 'overtime';
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  departmentId: number | null;
  departmentName: string;
  businessTypeName: string;
  status: string;
  approvalInstanceId: number | null;
  approvalNote: string | null;
  createdAt: string;
  reason: string | null;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  overtimeDate: string | null;
  hours: number | null;
}

export interface AttendanceAuditParams {
  page?: number;
  pageSize?: number;
  status?: string;
  recordType?: string;
  departmentId?: number;
  keyword?: string;
  vacationTypeId?: number;
  startDate?: string;
  endDate?: string;
}

export interface AttendanceAuditResult {
  code: number;
  message?: string;
  data?: {
    list: AttendanceAuditRow[];
    total: number;
    page: number;
    pageSize: number;
  };
}

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

export interface MonthlyRecordEmployee {
  id: number;
  employeeNo: string;
  name: string;
  department: { id: number; name: string };
}

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
  lateCount: number;
  earlyCount: number;
  leaveMinutes: number;
  status: string;
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  employee?: MonthlyRecordEmployee;
}

export interface MonthlyListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  departmentId?: number;
  month?: string;
  status?: string;
}

export interface MonthlyGenerateResult {
  code: number;
  message?: string;
  data?: {
    count?: number;
  };
}

export interface MonthlyConfirmResult {
  code: number;
  message?: string;
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
  restDuration?: number;
  lateThreshold?: number;
  earlyThreshold?: number;
  useGlobalThreshold?: boolean;
  color?: string;
  departmentId?: number | null;
  department?: { id: number; name: string } | null;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftCreateDto {
  name: string;
  startTime: string;
  endTime: string;
  isNextDay?: boolean;
  restDuration?: number;
  lateThreshold?: number;
  earlyThreshold?: number;
  useGlobalThreshold?: boolean;
  color?: string;
  departmentId?: number | null;
  description?: string;
  isActive?: boolean;
}

export interface ShiftUpdateDto extends Partial<ShiftCreateDto> {}

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

// 部门×月份排班矩阵：返回部门在职员工 + 范围内排班（含班次）
export interface ScheduleMatrixEmployee {
  id: number;
  employeeNo: string;
  name: string;
  departmentId: number;
}

export interface ScheduleMatrixParams {
  departmentId?: number;
  startDate?: string;
  endDate?: string;
}

export interface ScheduleMatrixResult {
  code: number;
  message?: string;
  data?: {
    employees: ScheduleMatrixEmployee[];
    schedules: Schedule[];
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
  baseDays?: number;
  enabled?: boolean;
  sortOrder?: number;
  carryOverRatio?: number | null;
  carryOverMaxDays?: number | null;
  seniorityRule?: { minYears?: number; maxYears?: number; days: number }[] | null;
  /** 月假额度：12 个元素，依次对应 1~12 月的每日额度（单位天）；null/缺省表示非月假类型 */
  monthlyDays?: number[] | null;
}

export interface VacationTypeCreateDto {
  code: string;
  name: string;
  baseDays?: number;
  enabled?: boolean;
  sortOrder?: number;
  carryOverRatio?: number | null;
  carryOverMaxDays?: number | null;
  seniorityRule?: { minYears?: number; maxYears?: number; days: number }[] | null;
  monthlyDays?: number[] | null;
}

export interface VacationBalance {
  id: number;
  employeeId: number;
  vacationTypeId: number;
  year: number;
  /** 抵扣月份（1~12）；月假类型按月建额度，非月假为 0 表示全年额度 */
  month: number;
  totalDays: number;
  usedDays: number;
  vacationType: VacationType;
  employee?: {
    id: number;
    employeeNo: string;
    name: string;
    department?: { id: number; name: string } | null;
  };
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
  /** 抵扣月份（1~12），月假类型请假必填 */
  month?: number | null;
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
  /** 抵扣月份（1~12），月假类型必填 */
  month?: number;
  reason: string;
}

export interface LeaveListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  status?: string;
  /** 按请假开始日期过滤（YYYY-MM-DD） */
  startDate?: string;
  /** 按请假结束日期过滤（YYYY-MM-DD） */
  endDate?: string;
}

export interface LeaveListResult {
  code: number;
  message?: string;
  data?: {
    list: LeaveRecord[];
    total: number;
    page: number;
    pageSize: number;
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
    page: number;
    pageSize: number;
  };
}

// ========== 考勤统计（月假，员工×月份） ==========

export interface AttendanceStatRow {
  employeeId: number;
  employeeNo: string;
  name: string;
  departmentId: number | null;
  departmentName: string;
  /** 应休天数 */
  totalDays: number;
  /** 已休天数 */
  usedDays: number;
  /** 剩余天数 */
  remainingDays: number;
  /** 加班时长（小时） */
  overtimeHours: number;
}

export interface AttendanceStatParams {
  year?: number;
  month?: number;
  departmentId?: number;
  employeeId?: number;
  keyword?: string;
}

export interface AttendanceStatResult {
  code: number;
  message?: string;
  data?: {
    rows: AttendanceStatRow[];
    total: number;
  };
}

// ========== 补卡申请 ==========

// 补卡类型值域与后端 punch-makeup-type.ts 保持一致：
// 领域规则 C3 只有上班卡（当日首次打卡）/ 下班卡（当日最后一次打卡）两种。
export type PunchMakeupType = 'check_in' | 'check_out';

export interface PunchMakeupRecord {
  id: number;
  employeeId: number;
  employeeName?: string;
  punchDate: string;
  punchType: PunchMakeupType;
  originalTime?: string;
  makeupTime?: string;
  reason: string;
  status: 'pending' | 'approving' | 'approved' | 'rejected';
  approvalInstanceId?: number | null;
  approverId?: number | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface MakeupCreateDto {
  punchDate: string;
  punchType: PunchMakeupType;
  originalTime?: string;
  makeupTime?: string;
  reason: string;
}

export interface MakeupListParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface MakeupListResult {
  code: number;
  message?: string;
  data?: {
    list: PunchMakeupRecord[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// ========== 打卡 ==========

export interface PunchResult {
  status: string;
  clockInTime?: string;
  clockOutTime?: string;
  shiftName?: string;
  lateMinutes?: number;
  earlyMinutes?: number;
  workHours?: number;
}

export interface PunchTodayResult {
  code: number;
  message?: string;
  data?: {
    id: number;
    firstPunch?: string | null;
    lastPunch?: string | null;
    punchCount: number;
    lateMinutes: number;
    earlyMinutes: number;
    status: string;
    shift?: { id: number; name: string; startTime: string; endTime: string; isNextDay: boolean; color?: string; isRest?: boolean } | null;
    hasSchedule?: boolean;
    isRestDay?: boolean;
    clockIn?: { allowed: boolean; message: string };
    clockOut?: { allowed: boolean; message: string };
  } | null;
}

// ========== 考勤设置 ==========

/**
 * 考勤设置（仅含后端实际被业务消费的 5 项）。
 * 其余预留项（年假/病假/加班/补卡开关/通知开关等）已从后端注册表与数据库清理。
 */
export interface AttendanceSettings {
  lateThreshold: number;
  earlyThreshold: number;
  earlyClockInMinutes: number;
  makeupDaysLimit: number;
  makeupMonthlyLimit: number;
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
  // 打卡导入（模拟打卡/设备数据导入，CSV 表头：工号,打卡时间,设备号）
  importPunchLogs(csv: string): Promise<{ code: number; message?: string; data?: { count?: number } }> {
    return request.post('/attendance/punch/import', { csv });
  },
  // 月报
  getMonthlyList(params: MonthlyListParams = {}): Promise<MonthlyListResult> {
    return request.get('/attendance/monthly', { params });
  },
  generateMonthly(data: { month: string; employeeId?: number }): Promise<MonthlyGenerateResult> {
    return request.post('/attendance/monthly/generate', data);
  },
  confirmMonthly(id: number): Promise<MonthlyConfirmResult> {
    return request.post(`/attendance/monthly/${id}/confirm`);
  },
  /**
   * 月报导出 URL（供 window.open 直接下载 CSV）
   * 注意：导出走独立的报表接口，不经过 request 实例的拦截器
   */
  exportMonthlyUrl(month: string): string {
    return `/api/v1/reports/attendance-monthly/export?month=${month}`;
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

  getScheduleMatrix(params: ScheduleMatrixParams = {}): Promise<ScheduleMatrixResult> {
    return request.get('/schedules/matrix', { params });
  },
  createSchedule(data: ScheduleCreateDto): Promise<ScheduleResult> {
    return request.post('/schedules', data);
  },
  getMyScheduleList(params: ScheduleListParams = {}): Promise<ScheduleListResult> {
    return request.get('/schedules/my', { params });
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
  // 打卡
  clockIn(): Promise<{ code: number; message?: string; data?: PunchResult }> {
    return request.post('/attendance/punch/clock-in');
  },
  clockOut(): Promise<{ code: number; message?: string; data?: PunchResult }> {
    return request.post('/attendance/punch/clock-out');
  },
  getTodayPunch(): Promise<PunchTodayResult> {
    return request.get('/attendance/punch/today');
  },
  selfSchedule(shiftId: number): Promise<{ code: number; message?: string; data?: any }> {
    return request.post('/attendance/punch/self-schedule', { shiftId });
  },
  getAvailableShifts(): Promise<{ code: number; message?: string; data?: Shift[] }> {
    return request.get('/shifts/available');
  },
  // 考勤设置
  getSettings(): Promise<{ code: number; message?: string; data?: AttendanceSettings }> {
    return request.get('/attendance/settings');
  },
  updateSettings(data: Partial<AttendanceSettings>): Promise<{ code: number; message?: string; data?: AttendanceSettings }> {
    return request.put('/attendance/settings', data);
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
  getBalanceList(params?: { employeeId?: number; year?: number; month?: number }): Promise<BalanceListResult> {
    return request.get('/vacation/balances', { params });
  },
  getMyBalances(params?: { year?: number; month?: number }): Promise<{ code: number; message?: string; data?: VacationBalance[] }> {
    return request.get('/vacation/balances/mine', { params });
  },
  // 假期类型设置
  getVacationTypes(): Promise<{ code: number; message?: string; data?: VacationType[] }> {
    return request.get('/vacation/types');
  },
  createVacationType(data: VacationTypeCreateDto): Promise<{ code: number; message?: string; data?: VacationType }> {
    return request.post('/vacation/types', data);
  },
  updateVacationType(id: number, data: Partial<VacationTypeCreateDto>): Promise<{ code: number; message?: string; data?: VacationType }> {
    return request.put(`/vacation/types/${id}`, data);
  },
  deleteVacationType(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/vacation/types/${id}`);
  },
  // 请假
  getLeaveList(params: LeaveListParams = {}): Promise<LeaveListResult> {
    return request.get('/leave-records', { params });
  },
  getMyLeaves(params: { page?: number; pageSize?: number; vacationType?: string; status?: string } = {}): Promise<LeaveListResult> {
    return request.get('/leave-records/mine', { params });
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
  getMyOvertimes(): Promise<OvertimeListResult> {
    return request.get('/overtime-records/mine');
  },
  createOvertime(data: OvertimeCreateDto): Promise<{ code: number; message?: string; data?: OvertimeRecord }> {
    return request.post('/overtime-records', data);
  },
  submitOvertime(id: number): Promise<{ code: number; message?: string }> {
    return request.post(`/overtime-records/${id}/submit`);
  },
  // 考勤统计（月假，员工×月份）
  getAttendanceStatistics(params: AttendanceStatParams = {}): Promise<AttendanceStatResult> {
    return request.get('/vacation/statistics', { params });
  },
  // 考勤申请聚合审计（批次六）
  getAuditList(params: AttendanceAuditParams): Promise<AttendanceAuditResult> {
    return request.get('/attendance/audit', { params });
  },
  // 补卡申请
  getMakeupList(params: MakeupListParams = {}): Promise<MakeupListResult> {
    return request.get('/attendance/punch/makeup', { params });
  },
  getMakeupDetail(id: number): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.get(`/attendance/punch/makeup/${id}`);
  },
  createMakeup(data: MakeupCreateDto): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.post('/attendance/punch/makeup', data);
  },
  updateMakeup(id: number, data: Partial<MakeupCreateDto>): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.put(`/attendance/punch/makeup/${id}`, data);
  },
  deleteMakeup(id: number): Promise<{ code: number; message?: string; data?: { success: boolean } }> {
    return request.delete(`/attendance/punch/makeup/${id}`);
  },
  submitMakeup(id: number): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.post(`/attendance/punch/makeup/${id}/submit`);
  },
};

export const punchMakeupApi = {
  list(params: { page?: number; pageSize?: number; status?: string; startDate?: string; endDate?: string } = {}): Promise<MakeupListResult> {
    return request.get('/attendance/punch/makeup', { params });
  },
  detail(id: number): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.get(`/attendance/punch/makeup/${id}`);
  },
  create(data: MakeupCreateDto): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.post('/attendance/punch/makeup', data);
  },
  update(id: number, data: { punchDate?: string; punchType?: PunchMakeupType; originalTime?: string; makeupTime?: string; reason?: string }): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.put(`/attendance/punch/makeup/${id}`, data);
  },
  remove(id: number): Promise<{ code: number; message?: string; data?: { success: boolean } }> {
    return request.delete(`/attendance/punch/makeup/${id}`);
  },
  submit(id: number): Promise<{ code: number; message?: string; data?: PunchMakeupRecord }> {
    return request.post(`/attendance/punch/makeup/${id}/submit`);
  },
};

// ========== 考勤异常（异常规则 + 异常记录） ==========

export interface ExceptionRule {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  departmentId?: number | null;
  threshold: number;
  thresholdMax?: number | null;
  autoResolve: boolean;
  autoResolveType?: string | null;
  deductMinutes: number;
  status: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExceptionRuleCreateDto {
  name: string;
  type: string;
  description?: string;
  departmentId?: number | null;
  threshold?: number;
  thresholdMax?: number | null;
  autoResolve?: boolean;
  autoResolveType?: string | null;
  deductMinutes?: number;
  status?: string;
  sortOrder?: number;
}

export interface ExceptionRuleUpdateDto extends Partial<ExceptionRuleCreateDto> {}

export interface ExceptionRecord {
  id: number;
  employeeId: number;
  workDate: string;
  type: string;
  description?: string | null;
  status: string;
  resolveType?: string | null;
  deductMinutes?: number | null;
  handledBy?: number | null;
  handledAt?: string | null;
  remark?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExceptionCreateDto {
  employeeId: number;
  workDate: string;
  type: string;
  description?: string;
  deductMinutes?: number;
  resolveType?: string;
}

export interface ExceptionListParams {
  status?: string;
  type?: string;
  employeeId?: number;
  workDate?: string;
}

export interface ExceptionHandleDto {
  status: string;
  remark?: string;
  handledBy?: number;
}

export interface ExceptionRuleListResult {
  code: number;
  message?: string;
  data?: { list: ExceptionRule[]; total: number };
}

export interface ExceptionListResult {
  code: number;
  message?: string;
  data?: { list: ExceptionRecord[]; total: number };
}

export interface ExceptionResult {
  code: number;
  message?: string;
  data?: ExceptionRecord;
}

export const exceptionApi = {
  /** 异常规则列表 */
  getExceptionRules(): Promise<ExceptionRuleListResult> {
    return request.get('/attendance/exception-rules');
  },
  /** 异常规则列表（别名） */
  listExceptionRules(): Promise<ExceptionRuleListResult> {
    return request.get('/attendance/exception-rules');
  },
  createExceptionRule(data: ExceptionRuleCreateDto): Promise<{ code: number; message?: string; data?: ExceptionRule }> {
    return request.post('/attendance/exception-rules', data);
  },
  updateExceptionRule(id: number, data: ExceptionRuleUpdateDto): Promise<{ code: number; message?: string; data?: ExceptionRule }> {
    return request.put(`/attendance/exception-rules/${id}`, data);
  },
  toggleExceptionRule(id: number): Promise<{ code: number; message?: string; data?: ExceptionRule }> {
    return request.patch(`/attendance/exception-rules/${id}/toggle`);
  },
  deleteExceptionRule(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/attendance/exception-rules/${id}`);
  },
  /** 异常记录列表 */
  listExceptions(params: ExceptionListParams = {}): Promise<ExceptionListResult> {
    return request.get('/attendance/exceptions', { params });
  },
  createException(data: ExceptionCreateDto): Promise<ExceptionResult> {
    return request.post('/attendance/exceptions', data);
  },
  handleException(id: number, body: ExceptionHandleDto): Promise<{ code: number; message?: string; data?: ExceptionRecord }> {
    return request.put(`/attendance/exceptions/${id}/status`, body);
  },
  deleteException(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/attendance/exceptions/${id}`);
  },
};

// ========== 扣款规则 ==========

export interface DeductionRule {
  id: number;
  name: string;
  type: string;
  method: string;
  amount?: number | null;
  percentage?: number | null;
  multiplier?: number | null;
  leaveType?: string | null;
  enabled: boolean;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeductionRuleCreateDto {
  name: string;
  type: string;
  method: string;
  amount?: number | null;
  percentage?: number | null;
  multiplier?: number | null;
  leaveType?: string | null;
  enabled?: boolean;
  description?: string;
}

export interface DeductionRuleUpdateDto extends Partial<DeductionRuleCreateDto> {}

export interface DeductionRuleListResult {
  code: number;
  message?: string;
  data?: { list: DeductionRule[]; total: number };
}

export interface DeductionRuleResult {
  code: number;
  message?: string;
  data?: DeductionRule;
}

export const deductionApi = {
  listDeductionRules(): Promise<DeductionRuleListResult> {
    return request.get('/attendance/deduction-rules');
  },
  createDeductionRule(data: DeductionRuleCreateDto): Promise<DeductionRuleResult> {
    return request.post('/attendance/deduction-rules', data);
  },
  updateDeductionRule(id: number, data: DeductionRuleUpdateDto): Promise<DeductionRuleResult> {
    return request.put(`/attendance/deduction-rules/${id}`, data);
  },
  deleteDeductionRule(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/attendance/deduction-rules/${id}`);
  },
};
