import { z } from 'zod';

// --- 元数据 Schema ---
export const assetCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string().nullable(),
  status: z.string().nullable(),
});

export const assetFormSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string().nullable(),
});

export const componentTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string().nullable(),
  sort_order: z.number().nullable(),
});

export const componentSchema = z.object({
  id: z.number(),
  type_id: z.number(),
  type_name: z.string().optional(),
  name: z.string(),
  model: z.string(),
  notes: z.string().nullable(),
  status: z.string().nullable(),
});

// --- 型号 (SKU) Schema ---
export const assetModelSchema = z.object({
  id: z.number(),
  name: z.string(),
  category_id: z.number().nullable(),
  category_name: z.string().optional(),
  form_id: z.number().nullable(),
  form_name: z.string().optional(),
  description: z.string().nullable(),
  status: z.string().nullable(),
  assigned_count: z.number().optional(),
  template: z.array(z.object({
    component_id: z.number(),
    quantity: z.number(),
    name: z.string().optional(),
    type_name: z.string().optional(),
  })).optional(),
});

// --- 实机 (Instance) Schema ---
export const deviceInstanceSchema = z.object({
  id: z.number(),
  asset_no: z.string(),
  model_id: z.number(),
  model_name: z.string().optional(),
  form_name: z.string().optional(),
  current_user_id: z.number().nullable(),
  user_name: z.string().optional(),
  user_avatar: z.string().optional(),
  department_name: z.string().optional(),
  device_status: z.enum(['idle', 'in_use', 'repairing', 'scrapped']),
  status: z.string().nullable(),
  category_name: z.string().optional(),
  components: z.array(z.any()).optional(),
  history: z.array(z.any()).optional(),
});

// --- 申请 (Request) Schema ---
export const assetRequestSchema = z.object({
  id: z.number(),
  asset_id: z.number(),
  asset_no: z.string().optional(),
  device_name: z.string().optional(),
  user_id: z.number(),
  applicant_name: z.string().optional(),
  department_name: z.string().optional(),
  type: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  admin_notes: z.string().nullable(),
  created_at: z.string().optional(),
});

export type AssetCategory = z.infer<typeof assetCategorySchema>;
export type AssetForm = z.infer<typeof assetFormSchema>;
export type ComponentType = z.infer<typeof componentTypeSchema>;
export type Component = z.infer<typeof componentSchema>;
export type AssetModel = z.infer<typeof assetModelSchema>;
export type DeviceInstance = z.infer<typeof deviceInstanceSchema>;
export type AssetRequest = z.infer<typeof assetRequestSchema>;

export interface AssetFilters {
  device_status?: string;
  department_id?: string;
  model_id?: string;
  keyword?: string;
}
