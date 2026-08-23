import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: any): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new BadRequestException({ code: 4000, message: `参数校验失败: ${messages}` });
  }
  return result.data;
}

export const createOnboardingSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  gender: z.string().optional(),
  phone: z.string().min(1, '手机号不能为空'),
  email: z.string().email().optional().or(z.literal('')),
  idCard: z.string().optional(),
  departmentId: z.number().int().positive('部门不能为空'),
  positionId: z.number().int().optional(),
  hireDate: z.string().min(1, '入职日期不能为空'),
  probationMonths: z.number().int().min(0).optional(),
  salary: z.number().min(0).optional(),
  remark: z.string().optional(),
});

export const updateOnboardingSchema = createOnboardingSchema.partial();

export const createResignationSchema = z.object({
  employeeId: z.number().int().positive(),
  reason: z.string().min(1, '原因不能为空'),
  resignDate: z.string().min(1, '离职日期不能为空'),
  handoverRemark: z.string().optional(),
  remark: z.string().optional(),
});

export const updateResignationSchema = createResignationSchema.partial();

export const createProbationSchema = z.object({
  employeeId: z.number().int().positive(),
  probationStartDate: z.string().min(1, '试用期开始日期不能为空'),
  probationEndDate: z.string().min(1, '试用期结束日期不能为空'),
  performance: z.string().optional(),
  remark: z.string().optional(),
});

export const updateProbationSchema = createProbationSchema.partial();

export const createContractSchema = z.object({
  employeeId: z.number().int().positive(),
  contractNo: z.string().min(1, '合同编号不能为空'),
  type: z.string().min(1, '合同类型不能为空'),
  startDate: z.string().min(1, '开始日期不能为空'),
  endDate: z.string().optional(),
  salary: z.number().min(0).optional(),
  position: z.string().optional(),
  remark: z.string().optional(),
});

export const updateContractSchema = createContractSchema.partial();

export const createAppealSchema = z.object({
  employeeId: z.number().int().positive(),
  appealDate: z.string().min(1, '申诉日期不能为空'),
  appealType: z.string().min(1, '申诉类型不能为空'),
  originalStatus: z.string().min(1, '原始状态不能为空'),
  reason: z.string().min(1, '申诉原因不能为空'),
  remark: z.string().optional(),
});

export const updateAppealSchema = createAppealSchema.partial();

export const createCertificateSchema = z.object({
  employeeId: z.number().int().positive(),
  name: z.string().min(1, '证书名称不能为空'),
  issuer: z.string().optional(),
  issueDate: z.string().optional(),
  expireDate: z.string().optional(),
  certNo: z.string().optional(),
  level: z.string().optional(),
  remark: z.string().optional(),
});

export const updateCertificateSchema = createCertificateSchema.partial();

export const createRewardSchema = z.object({
  employeeId: z.number().int().positive(),
  type: z.enum(['reward', 'punishment']),
  category: z.string().min(1, '分类不能为空'),
  reason: z.string().min(1, '原因不能为空'),
  amount: z.number().min(0, '奖惩金额不能为负').optional(),
  rewardDate: z.string().min(1, '日期不能为空'),
  remark: z.string().optional(),
});

export const updateRewardSchema = createRewardSchema.partial();

export const createTrainingSchema = z.object({
  employeeId: z.number().int().positive(),
  title: z.string().min(1, '培训标题不能为空'),
  category: z.string().optional(),
  trainer: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  hours: z.number().int().min(0).optional(),
  score: z.string().optional(),
  certificate: z.boolean().optional(),
  remark: z.string().optional(),
});

export const updateTrainingSchema = createTrainingSchema.partial();

export const createTransferSchema = z.object({
  employeeId: z.number().int().positive(),
  type: z.enum(['transfer', 'promotion', 'demotion', 'salary_adjust']),
  toDepartmentId: z.number().int().optional(),
  toPositionId: z.number().int().optional(),
  toSalary: z.number().min(0).optional(),
  effectiveDate: z.string().min(1, '生效日期不能为空'),
  reason: z.string().optional(),
  remark: z.string().optional(),
});

export const updateTransferSchema = createTransferSchema.partial();

export const createCertRequestSchema = z.object({
  employeeId: z.number().int().positive(),
  type: z.enum(['employment', 'income', 'resignation', 'other']),
  purpose: z.string().min(1, '用途不能为空'),
  remark: z.string().optional(),
});

export const updateCertRequestSchema = createCertRequestSchema.partial();
