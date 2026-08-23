import request from '@/lib/request';

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
  status?: string;
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
  salary?: string;
}

export interface UpdateEmployeeParams {
  name?: string;
  departmentId?: number;
  positionId?: number | null;
  hireDate?: string;
  phone?: string;
  salary?: string;
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
    return request.get(`/employees/tx/${type}`, { params });
  },

  createTx(type: string, data: any): Promise<any> {
    return request.post(`/employees/tx/${type}`, data);
  },

  getTxById(type: string, id: number): Promise<any> {
    return request.get(`/employees/tx/${type}/${id}`);
  },

  updateTx(type: string, id: number, data: any): Promise<any> {
    return request.patch(`/employees/tx/${type}/${id}`, data);
  },

  deleteTx(type: string, id: number): Promise<any> {
    return request.delete(`/employees/tx/${type}/${id}`);
  },

  submitTx(type: string, id: number, workflowCode: string): Promise<any> {
    return request.post(`/employees/tx/${type}/${id}/submit`, { workflowCode });
  },

  getTimeline(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    employeeId?: number;
  } = {}): Promise<{ code: number; message?: string; data?: { list: TimelineRecord[]; total: number; page: number; pageSize: number } }> {
    return request.get('/employees/timeline', { params });
  },
};

// ========== 员工标签 ==========

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
