import { FastifyRequest } from 'fastify'
import prisma from '../../prisma'
import { enqueueNotification } from '../../plugins/notification'
import { invalidateUserPermissionsCache } from '../../utils/permissionCache'

export async function handleOffboardingCompletion(request: FastifyRequest, employeeId: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { id: true, status: true, sessionVersion: true } } },
  })

  if (!employee?.user) return

  // 禁用用户账号
  await prisma.user.update({
    where: { id: employee.user.id },
    data: {
      status: 'inactive',
      sessionVersion: { increment: 1 },
    },
  })

  // 清除权限缓存
  await invalidateUserPermissionsCache(employee.user.id)

  // 自动生成资产归还任务
  const assignedAssets = await prisma.assetAssignment.findMany({
    where: { employeeId, status: 'assigned', returnedAt: null },
    include: { asset: { select: { name: true, assetNo: true, serialNo: true } } },
  })

  for (const assignment of assignedAssets) {
    const assetReturnTask = await prisma.offboardingTask.create({
      data: {
        employeeId,
        title: `归还资产：${assignment.asset.name}`,
        description: `请归还分配的资产：${assignment.asset.name}，序列号：${assignment.asset.serialNo || assignment.asset.assetNo || 'N/A'}`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
        status: 'pending',
        assignedTo: employee.userId ?? undefined,
      },
    })
    console.log(`[Offboarding] Created asset return task #${assetReturnTask.id} for asset ${assignment.asset.name}`)
  }

  console.log(`[Offboarding] Completed offboarding for employee ${employeeId}, user ${employee.user.id} disabled`)

  enqueueNotification(request, {
    userId: employee.user.id,
    title: '离职手续已完成',
    content: '您的离职手续已处理完毕，感谢您的付出，祝您未来一切顺利。',
    type: 'system',
    relatedId: employeeId,
    relatedType: 'employee',
  })
}

export async function handleOnboardingCompletion(request: FastifyRequest, employeeId: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: { select: { id: true, status: true, departmentId: true, positionId: true } },
      department: { select: { id: true, name: true } },
    },
  })

  if (!employee?.user) return

  const year = new Date().getFullYear()

  // 1. 创建假期余额
  const vacationTypes = await prisma.vacationType.findMany({
    where: { status: 'active' },
  })

  for (const vt of vacationTypes) {
    const existing = await prisma.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId,
          vacationTypeId: vt.id,
          year,
        },
      },
    })

    if (!existing) {
      await prisma.vacationBalance.create({
        data: {
          employeeId,
          vacationTypeId: vt.id,
          year,
          total: vt.totalDays,
          used: 0,
          balance: vt.totalDays,
        },
      })
    }
  }

  // 2. 确保用户账号激活
  if (employee.user.status !== 'active') {
    await prisma.user.update({
      where: { id: employee.user.id },
      data: { status: 'active', sessionVersion: { increment: 1 } },
    })
    await invalidateUserPermissionsCache(employee.user.id)
  }

  // 3. 生成标准入职任务（如果没有的话）
  const existingTasks = await prisma.onboardingTask.count({ where: { employeeId } })
  if (existingTasks === 0) {
    const defaultTasks = [
      { title: '开通系统账号', description: 'HR 协助开通各业务系统账号' },
      { title: '领取办公设备', description: 'IT 部门发放电脑、门禁卡等' },
      { title: '新人培训', description: '参加公司新人入职培训' },
      { title: '部门介绍', description: '部门负责人介绍团队和工作内容' },
    ]
    for (const task of defaultTasks) {
      await prisma.onboardingTask.create({
        data: {
          employeeId,
          title: task.title,
          description: task.description,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'pending',
        },
      })
    }
  }

  console.log(`[Onboarding] Completed onboarding setup for employee ${employeeId}`)

  if (employee.user.id) {
    enqueueNotification(request, {
      userId: employee.user.id,
      title: '欢迎加入！',
      content: '您的入职流程已完成，祝您工作愉快！请查看入职任务清单并尽快完成。',
      type: 'welcome',
      relatedId: employeeId,
      relatedType: 'employee',
    })
  }
}
