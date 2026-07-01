import prisma from '../prisma'

export interface TargetConfig {
  departmentIds?: number[]
  roleIds?: number[]
  tagIds?: number[]
  positionIds?: number[]
  jobLevelIds?: number[]
  userIds?: number[]
}

export async function getTargetUsers(
  targetType: string,
  targetConfig?: TargetConfig
): Promise<number[]> {
  switch (targetType) {
    case 'all': {
      const users = await prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'department': {
      if (!targetConfig?.departmentIds?.length) return []
      const users = await prisma.user.findMany({
        where: {
          status: 'active',
          departmentId: { in: targetConfig.departmentIds },
        },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'role': {
      if (!targetConfig?.roleIds?.length) return []
      const userRoles = await prisma.userRole.findMany({
        where: {
          roleId: { in: targetConfig.roleIds },
          user: { status: 'active' },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      return userRoles.map(ur => ur.userId)
    }
    case 'position': {
      if (!targetConfig?.positionIds?.length) return []
      const users = await prisma.user.findMany({
        where: {
          status: 'active',
          positionId: { in: targetConfig.positionIds },
        },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'jobLevel': {
      if (!targetConfig?.jobLevelIds?.length) return []
      const users = await prisma.user.findMany({
        where: {
          status: 'active',
          employee: {
            jobLevelId: { in: targetConfig.jobLevelIds },
          },
        },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'tag': {
      if (!targetConfig?.tagIds?.length) return []
      const assignments = await prisma.employeeTagAssignment.findMany({
        where: { tagId: { in: targetConfig.tagIds } },
        select: { employee: { select: { userId: true } } },
        distinct: ['employeeId'],
      })
      const userIds = assignments
        .map(a => a.employee.userId)
        .filter((id): id is number => id != null)
      return [...new Set(userIds)]
    }
    case 'employee':
    case 'custom': {
      if (!targetConfig?.userIds?.length) return []
      const users = await prisma.user.findMany({
        where: {
          id: { in: targetConfig.userIds },
          status: 'active',
        },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    default:
      return []
  }
}

export async function getTargetUsersWithInfo(
  targetType: string,
  targetConfig?: TargetConfig,
  page = 1,
  pageSize = 20
) {
  const userIds = await getTargetUsers(targetType, targetConfig)
  const total = userIds.length

  const paginatedIds = userIds.slice((page - 1) * pageSize, page * pageSize)

  const users = await prisma.user.findMany({
    where: { id: { in: paginatedIds } },
    select: {
      id: true,
      realName: true,
      username: true,
      avatar: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  })

  return { total, list: users }
}
