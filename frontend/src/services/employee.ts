import request from '@/lib/request';

export interface EmployeeTagLite {
  id: number;
  name: string;
  color?: string | null;
}

export interface Employee {
  id: number;
  employeeNo: string;
  name: string;
  departmentId: number;
  department?: { id: number; name: string; parentId?: number | null };
  departmentName?: string;
  positionId?: number | null;
  position?: { id: number; name: string } | null;
  positionName?: string;
  hireDate: string;
  resignDate?: string;
  phone?: string | null;
  status: 'active' | 'inactive' | 'resigned';
  salary: string;
  rating?: number;
  tags?: EmployeeTagLite[];
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  address?: string | null;
  education?: string | null;
  skills?: string | null;
  remark?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  name?: string;
  employeeNo?: string;
  departmentId?: number;
  positionId?: number;
  status?: string;
  rating?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

export interface EmployeeListResult {
  code: number;
  message?: string;
  data?: {
    list: Employee[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface EmployeeDetailResult {
  code: number;
  message?: string;
  data?: Employee;
}

export interface CreateEmployeeParams {
  employeeNo: string;
  name: string;
  departmentId: number;
  positionId?: number;
  hireDate: string;
  phone?: string;
  salary?: number;
  rating?: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  address?: string;
  education?: string;
  skills?: string;
  remark?: string;
  tagIds?: number[];
}

export interface UpdateEmployeeParams {
  name?: string;
  departmentId?: number;
  positionId?: number | null;
  hireDate?: string;
  phone?: string;
  salary?: number;
  /** 薪资生效月（YYYY-MM）：仅改薪时生效，留空由后端默认次月生效 */
  effectiveMonth?: string;
  rating?: number;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  address?: string | null;
  education?: string | null;
  skills?: string | null;
  remark?: string | null;
  tagIds?: number[];
}

export interface ResignParams {
  resignDate?: string;
  reason?: string;
}

export type TimelineRecordType = 'hire' | 'transfer' | 'promotion' | 'demotion' | 'salary_adjust' | 'resign';

export interface TimelineRecord {
  id: string;
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  type: TimelineRecordType;
  occurredAt: string; // YYYY-MM-DD
  fromText?: string | null;
  toText?: string | null;
  detailText: string;
  reason?: string | null;
}

const TX_SEG: Record<string, string> = {
  onboardings: 'onboarding',
  resignations: 'resignations',
  probations: 'probations',
  contracts: 'contracts',
  'attendance-appeals': 'appeals',
  certificates: 'certificates',
  rewards: 'rewards',
  trainings: 'trainings',
  transfers: 'transfers',
};

function txPath(type: string): string {
  return `/employees/${TX_SEG[type] ?? type}`;
}

export const employeeApi = {
  getList(params: EmployeeListParams = {}): Promise<EmployeeListResult> {
    return request.get('/employees', { params });
  },

  getById(id: number): Promise<EmployeeDetailResult> {
    return request.get(`/employees/${id}`);
  },

  getMe(): Promise<EmployeeDetailResult> {
    return request.get('/employees/me');
  },

  create(data: CreateEmployeeParams): Promise<EmployeeDetailResult> {
    return request.post('/employees', data);
  },

  update(id: number, data: UpdateEmployeeParams): Promise<EmployeeDetailResult> {
    return request.patch(`/employees/${id}`, data);
  },

  resign(id: number, data: ResignParams): Promise<EmployeeDetailResult> {
    return request.post(`/employees/${id}/resign`, data);
  },

  exportExcel(): Promise<Blob> {
    return request.get('/employees/export', { responseType: 'blob' });
  },

  downloadImportTemplate(): Promise<Blob> {
    return request.get('/employees/import/template', { responseType: 'blob' });
  },

  importExcel(file: File): Promise<{ code: number; message?: string; data?: { success: number; failed: number; errors: string[] } }> {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/employees/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getTxList(type: string, params: { page?: number; pageSize?: number; status?: string } = {}): Promise<any> {
    return request.get(txPath(type), { params });
  },

  /** 各事务类型的待处理数（draft+pending），供员工事务页签徽标 */
  getTxPendingCounts(): Promise<{ code: number; message?: string; data?: Record<string, number> }> {
    return request.get('/employees/tx-pending-counts');
  },

  createTx(type: string, data: any): Promise<any> {
    return request.post(txPath(type), data);
  },

  getTxById(type: string, id: number): Promise<any> {
    return request.get(`${txPath(type)}/${id}`);
  },

  updateTx(type: string, id: number, data: any): Promise<any> {
    return request.put(`${txPath(type)}/${id}`, data);
  },

  deleteTx(type: string, id: number): Promise<any> {
    return request.delete(`${txPath(type)}/${id}`);
  },

  /**
   * 合同附件上传：复用通用文件上传，返回附件 URL 供入库。
   */
  uploadContractFile(file: File, bizType = 'contract'): Promise<{
    code: number;
    message?: string;
    data?: { url: string; fileName: string };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return request.post(`/files/upload?bizType=${bizType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** 合同续签：原合同置为已到期，基于原员工新建合同 */
  renewContract(id: number, data: any): Promise<any> {
    return request.post(`/employees/contracts/${id}/renew`, data);
  },

  /** 合同终止/解除：置为已终止，写入终止日期与说明 */
  terminateContract(id: number, data: any): Promise<any> {
    return request.post(`/employees/contracts/${id}/terminate`, data);
  },

  submitTx(type: string, id: number, workflowCode: string): Promise<any> {
    return request.post(`${txPath(type)}/${id}/submit`, { workflowCode });
  },

  getTimeline(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    departmentId?: number;
    employeeId?: number;
  } = {}): Promise<{ code: number; message?: string; data?: { list: TimelineRecord[]; total: number; page: number; pageSize: number } }> {
    return request.get('/employees/timeline', { params });
  },

  getChangeLogs(params: EmployeeChangeLogParams = {}): Promise<EmployeeChangeLogResult> {
    return request.get('/employees/change-logs', { params });
  },

  // 批量状态更新（对齐老项目「一键在职/离休」）
  batchUpdateStatus(ids: number[], status: 'active' | 'resigned'): Promise<{
    code: number;
    message?: string;
    data?: { success: number; skipped: number };
  }> {
    return request.post('/employees/batch-update-status', { ids, status });
  },

  // 批量调整部门/岗位/职级
  batchUpdate(ids: number[], data: { departmentId?: number; positionId?: number | null; rating?: number }): Promise<{
    code: number;
    message?: string;
    data?: { success: number; skipped: number };
  }> {
    return request.post('/employees/batch-update', { ids, data });
  },

  // 单员工变动履历（含 入职/离职/再次入职 相关流水）
  getEmployeeChangeLogs(id: number): Promise<{
    code: number;
    message?: string;
    data?: EmployeeChangeLog[];
  }> {
    return request.get(`/employees/${id}/change-logs`);
  },
};

// ========== 员工变动流水（EmployeeChanges） ==========

export type EmployeeChangeType = 'admin_update' | 'self_update' | 'resign' | 'restore' | 'batch_update';

export interface EmployeeChangeLog {
  id: number;
  employeeId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number;
  changeType: EmployeeChangeType;
  createdAt: string;
  employee?: {
    employeeNo: string;
    name: string;
    hireDate?: string;
    department?: { id: number; name: string } | null;
    position?: { id: number; name: string } | null;
  } | null;
}

export interface EmployeeChangeLogParams {
  page?: number;
  pageSize?: number;
  changeType?: string;
  keyword?: string;
  departmentId?: number | string;
}

export interface EmployeeChangeLogResult {
  code: number;
  message?: string;
  data?: { list: EmployeeChangeLog[]; total: number; page: number; pageSize: number };
}

export interface EmployeeTag {
  id: number;
  name: string;
  color?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeTagCreateDto {
  name: string;
  color?: string;
  sortOrder?: number;
}

export type EmployeeTagUpdateDto = Partial<EmployeeTagCreateDto>;

export interface TagListResult {
  code: number;
  message?: string;
  data?: { list: EmployeeTag[]; total: number };
}

export interface TagResult {
  code: number;
  message?: string;
  data?: EmployeeTag;
}

export const employeeTagApi = {
  list(): Promise<TagListResult> {
    return request.get('/employee-tags');
  },
  create(data: EmployeeTagCreateDto): Promise<TagResult> {
    return request.post('/employee-tags', data);
  },
  update(id: number, data: EmployeeTagUpdateDto): Promise<TagResult> {
    return request.put(`/employee-tags/${id}`, data);
  },
  remove(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/employee-tags/${id}`);
  },
};

// ========== 打卡定位 ==========

export type LocationWorkType = 'office' | 'home' | 'field';

export interface AttendanceLocation {
  id: number;
  name: string;
  address?: string | null;
  /** 后端 Decimal 序列化为字符串，故用 number | string */
  latitude: number | string;
  longitude: number | string;
  radius: number;
  workType: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceLocationCreateDto {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius?: number;
  workType?: string;
  enabled?: boolean;
}

export type AttendanceLocationUpdateDto = Partial<AttendanceLocationCreateDto>;

export interface LocationListResult {
  code: number;
  message?: string;
  data?: { list: AttendanceLocation[]; total: number };
}

export interface LocationResult {
  code: number;
  message?: string;
  data?: AttendanceLocation;
}

export const attendanceLocationApi = {
  list(): Promise<LocationListResult> {
    return request.get('/attendance-locations');
  },
  create(data: AttendanceLocationCreateDto): Promise<LocationResult> {
    return request.post('/attendance-locations', data);
  },
  update(id: number, data: AttendanceLocationUpdateDto): Promise<LocationResult> {
    return request.put(`/attendance-locations/${id}`, data);
  },
  remove(id: number): Promise<{ code: number; message?: string }> {
    return request.delete(`/attendance-locations/${id}`);
  },
};
