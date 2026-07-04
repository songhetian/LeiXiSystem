import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 初始化系统预设的入职步骤类型
 * 幂等执行：已存在同 code 的记录会跳过
 */
async function main() {
  console.log('🌱 开始初始化入职步骤类型...')

  const presets = [
    {
      name: '文档提交',
      code: 'OST_DOCUMENT',
      icon: 'IconFile',
      color: '#165DFF',
      description: '员工提交入职所需文档（身份证、学历证、银行卡等）',
      sortOrder: 1,
      isSystem: true,
    },
    {
      name: '任务办理',
      code: 'OST_TASK',
      icon: 'IconCheckCircle',
      color: '#00B42A',
      description: '办理工位分配、邮箱开通、系统账号开通等任务',
      sortOrder: 2,
      isSystem: true,
    },
    {
      name: '会议参加',
      code: 'OST_MEETING',
      icon: 'IconCalendar',
      color: '#FF7D00',
      description: '参加入职欢迎会、部门介绍会等会议',
      sortOrder: 3,
      isSystem: true,
    },
    {
      name: '培训完成',
      code: 'OST_TRAINING',
      icon: 'IconBook',
      color: '#722ED1',
      description: '完成公司文化、规章制度、岗位技能等培训',
      sortOrder: 4,
      isSystem: true,
    },
    {
      name: '系统开通',
      code: 'OST_SYSTEM',
      icon: 'IconDesktop',
      color: '#0FC6C2',
      description: '开通各类业务系统账号及权限配置',
      sortOrder: 5,
      isSystem: true,
    },
  ]

  let inserted = 0
  let skipped = 0

  for (const preset of presets) {
    const existing = await prisma.onboardingStepType.findUnique({
      where: { code: preset.code },
    })
    if (existing) {
      console.log(`  ⏭️  跳过已存在: ${preset.code} (${preset.name})`)
      skipped++
      continue
    }

    await prisma.onboardingStepType.create({ data: preset })
    console.log(`  ✅ 新增: ${preset.code} (${preset.name})`)
    inserted++
  }

  console.log(`\n✨ 初始化完成: 新增 ${inserted} 条, 跳过 ${skipped} 条`)
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
