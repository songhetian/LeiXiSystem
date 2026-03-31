import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
  rememberPassword: z.boolean().optional(),
});

export const registerSchema = z.object({
  real_name: z.string().min(1, '请输入真实姓名'),
  username: z.string().min(1, '请输入用户名'),
  email: z.string().email('无效的邮箱地址').or(z.literal('')),
  phone: z.string().optional(),
  password: z.string().min(6, '密码长度至少6位'),
  department_id: z.string().min(1, '请选择部门'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export interface AuthUser {
  id: number;
  username: string;
  real_name: string;
  role: string;
  permissions?: string[];
  department_id?: number;
  [key: string]: any;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  expiresIn?: number;
  refresh_token?: string;
  sessionToken?: string;
  message?: string;
}

export interface SessionCheckResponse {
  hasActiveSession: boolean;
  sessionCreatedAt?: string;
}

export interface Department {
  id: number | string;
  name: string;
}
