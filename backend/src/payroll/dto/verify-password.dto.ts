import { z } from 'zod';

/** 工资条二级密码验证入参（复用登录密码做二次校验） */
export const verifyPayslipPasswordSchema = z.object({
  password: z.string().min(1, '请输入二级密码'),
});

export type VerifyPayslipPasswordDto = z.infer<typeof verifyPayslipPasswordSchema>;
