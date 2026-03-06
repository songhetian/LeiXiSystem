import { z } from 'zod';

// --- Reimbursement Schemas ---

export const reimbursementItemSchema = z.object({
  id: z.number().optional(),
  item_type: z.string(),
  amount: z.number(),
  expense_date: z.string(),
  description: z.string().nullable(),
  attachment_url: z.string().nullable(),
});

export const reimbursementAttachmentSchema = z.object({
  id: z.number(),
  file_name: z.string(),
  file_url: z.string(),
});

export const reimbursementSchema = z.object({
  id: z.number(),
  reimbursement_no: z.string(),
  user_id: z.number(),
  employee_id: z.number().nullable(),
  department_id: z.number().nullable(),
  department_name: z.string().optional(),
  applicant_name: z.string().optional(),
  title: z.string(),
  total_amount: z.number(),
  remark: z.string().nullable(),
  type: z.string(),
  status: z.enum(['draft', 'pending', 'approving', 'approved', 'rejected', 'returned', 'cancelled']),
  current_node_id: z.number().nullable(),
  current_node_name: z.string().optional(),
  is_approvable: z.boolean().optional(),
  created_at: z.string(),
  items: z.array(reimbursementItemSchema).optional(),
  attachments: z.array(reimbursementAttachmentSchema).optional(),
  workflow: z.any().optional(),
});

export const reimbursementTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
});

export const createReimbursementSchema = z.object({
  title: z.string().min(1, '请输入标题'),
  type: z.string().min(1, '请选择分类'),
  remark: z.string().optional(),
  amount: z.number(),
  status: z.enum(['draft', 'pending']),
  items: z.array(z.object({
    item_type: z.string(),
    amount: z.number().min(0.01, '金额必须大于0'),
    date: z.string(),
    description: z.string().optional(),
    attachment_url: z.string().nullable().optional(),
  })),
  attachments: z.array(z.string()).optional(),
});

export type Reimbursement = z.infer<typeof reimbursementSchema>;
export type ReimbursementItem = z.infer<typeof reimbursementItemSchema>;
export type ReimbursementType = z.infer<typeof reimbursementTypeSchema>;
export type CreateReimbursementInput = z.infer<typeof createReimbursementSchema>;

export interface ReimbursementFilters {
  status?: string;
  user_id?: number;
  department_id?: string;
  keyword?: string;
  page?: number;
  limit?: number;
}
