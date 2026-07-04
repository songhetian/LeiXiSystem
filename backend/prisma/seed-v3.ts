// Seed script for v3 modules
// Run with: npx ts-node prisma/seed-v3.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding v3 modules...')

  // N1: 2026 Holiday Calendar
  const holidayList = await prisma.holidayList.upsert({
    where: { id: 1 },
    create: {
      name: '2026年中国法定节假日',
      year: 2026,
      country: 'CN',
      isDefault: true,
      status: 'active',
    },
    update: { name: '2026年中国法定节假日' },
  })
  console.log(`✅ Holiday list: ${holidayList.name}`)

  // Sample holiday dates
  const holidays = [
    ['2026-01-01', '元旦', false], ['2026-05-01', '劳动节', false],
    ['2026-10-01', '国庆节', false], ['2026-02-09', '春节', false],
  ]
  for (const [date, name, isWork] of holidays) {
    await prisma.holidayDate.upsert({
      where: { holidayListId_date: { holidayListId: holidayList.id, date: new Date(date) } },
      create: { holidayListId: holidayList.id, date: new Date(date), name, isWorkingDay: isWork },
      update: {},
    })
  }
  console.log(`✅ ${holidays.length} holiday dates seeded`)

  // G2: Default SLA Policies
  const slaPolicies = [
    { name: 'VIP-紧急响应', priority: 'urgent', customerTier: 'vip', responseTime: 5, resolutionTime: 60 },
    { name: 'VIP-标准响应', priority: 'normal', customerTier: 'vip', responseTime: 15, resolutionTime: 240 },
    { name: '普通-紧急响应', priority: 'urgent', customerTier: 'normal', responseTime: 10, resolutionTime: 120 },
    { name: '普通-标准响应', priority: 'normal', customerTier: 'normal', responseTime: 30, resolutionTime: 480 },
    { name: '默认SLA（兜底）', priority: null, customerTier: null, responseTime: 60, resolutionTime: 1440 },
  ]

  for (const sla of slaPolicies) {
    await prisma.helpdeskSLA.upsert({
      where: { id: slaPolicies.indexOf(sla) + 1 },
      create: {
        name: sla.name,
        priority: sla.priority,
        customerTier: sla.customerTier,
        responseTime: sla.responseTime,
        resolutionTime: sla.resolutionTime,
        workdaysOnly: true,
        holidayListId: holidayList.id,
        escalationEnabled: sla.priority === 'urgent',
        status: 'active',
      },
      update: { name: sla.name },
    })
  }
  console.log(`✅ ${slaPolicies.length} SLA policies seeded`)

  // N8: Canned Responses
  const responses = [
    { title: '密码重置指引', content: '您好 {{customer_name}}，关于密码重置，请按以下步骤操作...', category: '账号问题' },
    { title: '工单进度查询回复', content: '您好 {{customer_name}}，您的工单（{{ticket_id}}）当前状态为处理中...', category: '通用' },
    { title: '退款处理中通知', content: '您好 {{customer_name}}，您的退款申请已收到...', category: '退款' },
    { title: '工单已解决确认', content: '您好 {{customer_name}}，您的工单（{{ticket_id}}）已解决...', category: '通用' },
    { title: '需要补充信息', content: '您好 {{customer_name}}，为了更好地帮您解决问题...', category: '通用' },
  ]

  for (const r of responses) {
    await prisma.cannedResponse.upsert({
      where: { id: responses.indexOf(r) + 1 },
      create: {
        title: r.title,
        content: r.content,
        category: r.category,
        isGlobal: true,
        status: 'active',
        createdBy: 1,
      },
      update: { title: r.title },
    })
  }
  console.log(`✅ ${responses.length} canned responses seeded`)

  // N10: Alert Thresholds
  const alerts = [
    { metricKey: 'queue_length', metricName: '排队工单数', warnThreshold: 10, criticalThreshold: 20, comparisonOperator: '>=' },
    { metricKey: 'sla_breach_rate', metricName: 'SLA违约率(%)', warnThreshold: 10, criticalThreshold: 20, comparisonOperator: '>=' },
    { metricKey: 'absence_count', metricName: '缺勤人数', warnThreshold: 5, criticalThreshold: 10, comparisonOperator: '>=' },
    { metricKey: 'deviation_rate', metricName: '排班偏差率(%)', warnThreshold: 15, criticalThreshold: 30, comparisonOperator: '>=' },
    { metricKey: 'satisfaction_avg', metricName: '满意度均分', warnThreshold: 3.5, criticalThreshold: 3.0, comparisonOperator: '<=' },
  ]

  for (const a of alerts) {
    await prisma.dashboardAlertConfig.upsert({
      where: { metricKey: a.metricKey },
      create: {
        metricKey: a.metricKey,
        metricName: a.metricName,
        warnThreshold: a.warnThreshold,
        criticalThreshold: a.criticalThreshold,
        comparisonOperator: a.comparisonOperator,
        enabled: true,
      },
      update: { metricName: a.metricName },
    })
  }
  console.log(`✅ ${alerts.length} alert thresholds seeded`)

  // N2: KB Categories
  const categories = [
    { name: '产品知识', categoryType: 'kb' }, { name: '技术问题', categoryType: 'kb' },
    { name: '账号问题', categoryType: 'kb' }, { name: '退款流程', categoryType: 'kb' },
    { name: '公司制度', categoryType: 'doc' }, { name: '培训材料', categoryType: 'doc' },
    { name: 'SOP流程', categoryType: 'doc' },
  ]

  for (const c of categories) {
    await prisma.kbCategory.upsert({
      where: { id: categories.indexOf(c) + 1 },
      create: { name: c.name, sortOrder: categories.indexOf(c) + 1, categoryType: c.categoryType, visibility: 'all' },
      update: { name: c.name },
    })
  }
  console.log(`✅ ${categories.length} KB categories seeded`)

  // G7: Lifecycle Templates
  const onboardingTemplate = await prisma.lifecycleTaskTemplate.upsert({
    where: { id: 1 },
    create: { name: '标准入职流程', type: 'onboarding' },
    update: { name: '标准入职流程' },
  })

  const onboardingTasks = [
    { taskName: '创建系统账号和邮箱', assignedRole: 'IT', sortOrder: 1, deadlineDays: 1 },
    { taskName: '分配办公设备', assignedRole: 'IT', sortOrder: 2, deadlineDays: 2 },
    { taskName: '签署劳动合同', assignedRole: 'HR', sortOrder: 3, deadlineDays: 1 },
    { taskName: '开通门禁和工牌', assignedRole: 'HR', sortOrder: 4, deadlineDays: 2 },
    { taskName: '安排新员工培训', assignedRole: '直属主管', sortOrder: 5, deadlineDays: 5 },
  ]

  for (const t of onboardingTasks) {
    await prisma.lifecycleTemplateTask.upsert({
      where: { id: onboardingTasks.indexOf(t) + 1 },
      create: { ...t, templateId: onboardingTemplate.id },
      update: { taskName: t.taskName },
    })
  }

  const offboardingTemplate = await prisma.lifecycleTaskTemplate.upsert({
    where: { id: 2 },
    create: { name: '标准离职流程', type: 'offboarding' },
    update: { name: '标准离职流程' },
  })

  const offboardingTasks = [
    { taskName: '回收办公设备', assignedRole: 'IT', sortOrder: 1, deadlineDays: 3 },
    { taskName: '关闭系统账号', assignedRole: 'IT', sortOrder: 2, deadlineDays: 1 },
    { taskName: '结算工资', assignedRole: '财务', sortOrder: 3, deadlineDays: 5 },
    { taskName: '离职面谈', assignedRole: 'HR', sortOrder: 4, deadlineDays: 3 },
    { taskName: '开具离职证明', assignedRole: 'HR', sortOrder: 5, deadlineDays: 3 },
    { taskName: '归档人事档案', assignedRole: 'HR', sortOrder: 6, deadlineDays: 5 },
  ]

  for (const t of offboardingTasks) {
    await prisma.lifecycleTemplateTask.upsert({
      where: { id: offboardingTasks.indexOf(t) + 10 },
      create: { ...t, templateId: offboardingTemplate.id },
      update: { taskName: t.taskName },
    })
  }

  console.log('✅ Lifecycle templates seeded')
  console.log('\n🎉 Seed completed!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
