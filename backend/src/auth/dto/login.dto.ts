import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(50),
  password: z.string().min(1, '密码不能为空').max(100),
});

export type LoginDto = z.infer<typeof loginSchema>;
