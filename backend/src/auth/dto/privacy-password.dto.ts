import { z } from 'zod';

/**
 * 隐私二级密码：强度策略独立于登录密码（常见为 6 位数字），仅限制长度。
 */
const privacyPassword = z.string().min(6, '二级密码至少 6 位').max(64, '二级密码最多 64 位');

/** 设置/修改隐私二级密码：已设置过时 oldPassword 必填（服务层按状态校验） */
export const setPrivacyPasswordSchema = z.object({
  password: privacyPassword,
  oldPassword: z.string().min(1, '请输入原二级密码').max(64).optional(),
});

/** 忘记二级密码：用登录密码核身后重置 */
export const resetPrivacyPasswordSchema = z.object({
  loginPassword: z.string().min(1, '请输入登录密码').max(64),
  password: privacyPassword,
});

export type SetPrivacyPasswordDto = z.infer<typeof setPrivacyPasswordSchema>;
export type ResetPrivacyPasswordDto = z.infer<typeof resetPrivacyPasswordSchema>;
