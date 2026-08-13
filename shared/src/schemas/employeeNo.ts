// 工号校验规则（CONTEXT.md A7 已确认）：^[A-Za-z0-9-]{2,20}$
import { z } from 'zod';

export const employeeNoSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]{2,20}$/, '工号须为 2-20 位字母/数字/连字符');
