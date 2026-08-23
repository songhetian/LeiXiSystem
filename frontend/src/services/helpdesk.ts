import request from '@/lib/request';

// ========== 工单（helpdesk ticket） ==========

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/** 工单关联人员（请求人 / 处理人），来自 User 关联的员工信息 */
export interface HelpdeskPerson {
  id: number;
  name: string | null;
  employeeNo: string | null;
}

export interface HelpdeskTicket {
  id: number;
  ticketNo: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority: string;
  status: string;
  requesterId?: number | null;
  assigneeId?: number | null;
  slaId?: number | null;
  dueAt?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  requester?: HelpdeskPerson | null;
  assignee?: HelpdeskPerson | null;
}

export interface TicketListParams {
  status?: string;
  priority?: string;
  assigneeId?: number;
}

export interface TicketCreateDto {
  title: string;
  description?: string;
  category?: string;
  priority?: TicketPriority;
  assigneeId?: number | null;
}

export interface TicketUpdateDto {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  assigneeId?: number | null;
}

// ========== SLA（helpdesk sla） ==========

export interface HelpdeskSla {
  id: number;
  name: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SlaCreateDto {
  name: string;
  priority: string;
  firstResponseMinutes?: number;
  resolutionMinutes?: number;
  enabled?: boolean;
}

export type SlaUpdateDto = Partial<SlaCreateDto>;

// ========== 通用响应结构 ==========

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: { list: T[]; total: number };
}

export interface ItemResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export interface SimpleResult {
  code: number;
  message?: string;
}

// ========== API ==========

export const helpdeskApi = {
  // ---- 工单 ----
  listTickets(params: TicketListParams = {}): Promise<ListResult<HelpdeskTicket>> {
    return request.get('/helpdesk/tickets', { params });
  },
  createTicket(data: TicketCreateDto): Promise<ItemResult<HelpdeskTicket>> {
    return request.post('/helpdesk/tickets', data);
  },
  updateTicket(id: number, data: TicketUpdateDto): Promise<ItemResult<HelpdeskTicket>> {
    return request.put(`/helpdesk/tickets/${id}`, data);
  },
  resolveTicket(id: number): Promise<ItemResult<HelpdeskTicket>> {
    return request.put(`/helpdesk/tickets/${id}/resolve`);
  },
  deleteTicket(id: number): Promise<SimpleResult> {
    return request.delete(`/helpdesk/tickets/${id}`);
  },
  // ---- SLA ----
  listSlas(): Promise<ListResult<HelpdeskSla>> {
    return request.get('/helpdesk/slas');
  },
  createSla(data: SlaCreateDto): Promise<ItemResult<HelpdeskSla>> {
    return request.post('/helpdesk/slas', data);
  },
  updateSla(id: number, data: SlaUpdateDto): Promise<ItemResult<HelpdeskSla>> {
    return request.put(`/helpdesk/slas/${id}`, data);
  },
  deleteSla(id: number): Promise<SimpleResult> {
    return request.delete(`/helpdesk/slas/${id}`);
  },
};