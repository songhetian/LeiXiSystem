import request from '@/lib/request';

export interface ReimbursementType {
  id: number;
  name: string;
  code: string;
  description?: string;
  status: 'active' | 'inactive';
}

export interface ReimbursementItem {
  id?: number;
  itemType?: string;
  name?: string;
  amount: number;
  expenseDate?: string;
  description?: string;
  attachmentUrl?: string;
}

export interface ReimbursementAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  createdAt?: string;
}

export interface Reimbursement {
  id: number;
  reimbursementNo?: string | null;
  applicantId: number;
  applicantName: string;
  departmentName?: string;
  title: string;
  typeCode?: string;
  typeName?: string;
  totalAmount: number;
  status: 'draft' | 'pending' | 'approving' | 'approved' | 'rejected' | 'cancelled';
  description?: string;
  createdAt: string;
  updatedAt: string;
  items?: ReimbursementItem[];
  attachments?: ReimbursementAttachment[];
}

export interface ReimbursementListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export interface CreateReimbursementParams {
  title: string;
  typeCode: string;
  remark?: string;
  totalAmount: number;
  status?: 'draft' | 'pending';
  items: Array<{
    itemType?: string;
    name?: string;
    amount: number;
    expenseDate?: string;
    description?: string;
    attachmentUrl?: string;
  }>;
  attachments?: Array<{ fileName: string; fileUrl: string }>;
}

export interface ApprovalActionParams {
  comment?: string;
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export const reimbursementApi = {
  // ===== 通用文件上传（本地磁盘，发票/附件）=====
  uploadFile(file: File, bizType: string = 'reimbursement'): Promise<DetailResult<UploadResult>> {
    const formData = new FormData();
    formData.append('file', file);
    return request.post(`/files/upload?bizType=${bizType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // ===== 一级报销类型 =====
  getTypes(): Promise<DetailResult<ReimbursementType[]>> {
    return request.get('/reimbursements/types');
  },

  getAllTypes(): Promise<DetailResult<ReimbursementType[]>> {
    return request.get('/reimbursements/types/all');
  },

  createType(params: { code?: string; name: string; description?: string }): Promise<DetailResult<ReimbursementType>> {
    return request.post('/reimbursements/types', params);
  },

  updateType(
    id: number,
    params: { name?: string; description?: string; status?: string },
  ): Promise<DetailResult<ReimbursementType>> {
    return request.put(`/reimbursements/types/${id}`, params);
  },

  deleteType(id: number): Promise<DetailResult<any>> {
    return request.delete(`/reimbursements/types/${id}`);
  },

  // ===== 二级费用类型（对齐老项目 expense_types）=====
  getExpenseTypes(): Promise<DetailResult<ExpenseType[]>> {
    return request.get('/reimbursements/expense-types');
  },

  getAllExpenseTypes(): Promise<DetailResult<ExpenseType[]>> {
    return request.get('/reimbursements/expense-types/all');
  },

  createExpenseType(params: { name: string; unit?: string; sortOrder?: number }): Promise<DetailResult<ExpenseType>> {
    return request.post('/reimbursements/expense-types', params);
  },

  updateExpenseType(
    id: number,
    params: { name?: string; unit?: string; sortOrder?: number; status?: string },
  ): Promise<DetailResult<ExpenseType>> {
    return request.put(`/reimbursements/expense-types/${id}`, params);
  },

  deleteExpenseType(id: number): Promise<DetailResult<any>> {
    return request.delete(`/reimbursements/expense-types/${id}`);
  },

  // ===== 报销单 =====
  getMyReimbursements(params: ReimbursementListParams = {}): Promise<ListResult<Reimbursement>> {
    return request.get('/reimbursements/mine', { params });
  },

  getPendingApprovals(params: ReimbursementListParams = {}): Promise<ListResult<Reimbursement>> {
    return request.get('/reimbursements/pending', { params });
  },

  getDetail(id: number): Promise<DetailResult<Reimbursement>> {
    return request.get(`/reimbursements/${id}`);
  },

  createReimbursement(params: CreateReimbursementParams): Promise<DetailResult<{ id: number }>> {
    return request.post('/reimbursements', params);
  },

  submitApproval(id: number): Promise<DetailResult<Reimbursement>> {
    return request.post(`/reimbursements/${id}/submit`, {});
  },

  cancelReimbursement(id: number): Promise<DetailResult<any>> {
    return request.post(`/reimbursements/${id}/cancel`, {});
  },

  removeReimbursement(id: number): Promise<DetailResult<any>> {
    return request.delete(`/reimbursements/${id}`);
  },

  approve(id: number, params: ApprovalActionParams = {}): Promise<DetailResult<Reimbursement>> {
    return request.post(`/reimbursements/${id}/approve`, params);
  },

  reject(id: number, params: ApprovalActionParams = {}): Promise<DetailResult<Reimbursement>> {
    return request.post(`/reimbursements/${id}/reject`, params);
  },
};

export interface ExpenseType {
  id: number;
  name: string;
  unit?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
}

export interface UploadResult {
  url: string;
  fileName: string;
}