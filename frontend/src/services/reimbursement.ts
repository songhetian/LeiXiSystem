import request from '@/lib/request';

export interface ReimbursementType {
  id: number;
  name: string;
  code: string;
  description?: string;
  maxAmount?: number;
  status: 'active' | 'inactive';
}

export interface ReimbursementItem {
  id?: number;
  typeId: number;
  typeName?: string;
  amount: number;
  description: string;
  date: string;
  receiptUrl?: string;
}

export interface Reimbursement {
  id: number;
  applicantId: number;
  applicantNo: string;
  applicantName: string;
  departmentName: string;
  title: string;
  totalAmount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  description?: string;
  currentApproverId?: number;
  currentApproverName?: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string;
  items: ReimbursementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ReimbursementListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
}

export interface CreateReimbursementParams {
  title: string;
  totalAmount: number;
  description?: string;
  items: Omit<ReimbursementItem, 'id' | 'typeName'>[];
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
  getTypes(): Promise<DetailResult<ReimbursementType[]>> {
    return request.get('/reimbursements/types');
  },

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

  approve(id: number, params: ApprovalActionParams = {}): Promise<DetailResult<Reimbursement>> {
    return request.post(`/reimbursements/${id}/approve`, params);
  },

  reject(id: number, params: ApprovalActionParams = {}): Promise<DetailResult<Reimbursement>> {
    return request.post(`/reimbursements/${id}/reject`, params);
  },
};
