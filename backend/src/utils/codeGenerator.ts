import prisma from '../prisma'

/**
 * 实体类型前缀映射
 * 生成编码格式：{PREFIX}_{YYYYMMDD}_{4位随机}，如 SHIFT_20260702_a3f9
 */
const ENTITY_PREFIX: Record<string, string> = {
  shift: 'SHIFT',
  scheduleRule: 'RULE',
  scheduleTemplate: 'TPL',
  overtimeType: 'OT',
  vacationType: 'VAC',
  assetCategory: 'ASSET',
  helpdeskCategory: 'HD',
  trainingCourse: 'TRN',
  ssoApp: 'SSO',
  salaryComponent: 'SAL',
  onboardingStepType: 'OST',
}

/**
 * 为指定实体生成唯一编码
 *
 * @param entityType 实体类型标识（见 ENTITY_PREFIX）
 * @param prismaModel Prisma 模型代理，用于查重。如 prisma.shift
 * @returns 唯一编码字符串
 *
 * @example
 * const code = await generateCode('shift', prisma.shift)
 * // => 'SHIFT_20260702_a3f9'
 */
export async function generateCode(
  entityType: string,
  prismaModel: { findUnique: (args: { where: { code: string } }) => Promise<any> }
): Promise<string> {
  const prefix = ENTITY_PREFIX[entityType] || 'GEN'
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  for (let attempt = 0; attempt < 5; attempt++) {
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    const code = `${prefix}_${dateStr}_${random}`
    const existing = await prismaModel.findUnique({ where: { code } })
    if (!existing) {
      return code
    }
  }

  // 极端情况：5 次都冲突，加时间戳
  const ts = Date.now().toString(36).slice(-4).toUpperCase()
  return `${prefix}_${dateStr}_${ts}`
}
