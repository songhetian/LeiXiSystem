import prisma from '../prisma'
import type { AuthUser } from '../types/fastify'

export type DataScopeType =
  | 'self'
  | 'direct_subordinates'
  | 'department'
  | 'department_tree'
  | 'assigned_departments'
  | 'all'

async function getRoleDataScopes(roleNames: string[]) {
  if (!roleNames.length) return []

  return prisma.roleDataScope.findMany({
    where: { role: { name: { in: roleNames } } },
    include: { role: true },
  })
}

function collectDepartmentIds(scopes: Awaited<ReturnType<typeof getRoleDataScopes>>, fallbackDepartmentId: number | null) {
  const ids = new Set<number>()
  for (const scope of scopes) {
    const values = Array.isArray(scope.departmentIds) ? scope.departmentIds : []
    values.forEach((value) => {
      const id = Number(value)
      if (Number.isInteger(id)) ids.add(id)
    })
  }
  if (fallbackDepartmentId) ids.add(fallbackDepartmentId)
  return Array.from(ids)
}

export async function buildEmployeeDataScopeWhere(user: AuthUser) {
  if (user.roles.includes('超级管理员') || user.permissions.includes('*')) {
    return {}
  }

  const scopes = await getRoleDataScopes(user.roles)
  const scopeTypes = scopes.map((scope) => scope.scopeType as DataScopeType)

  if (scopeTypes.includes('all')) {
    return {}
  }

  if (scopeTypes.includes('assigned_departments')) {
    const departmentIds = collectDepartmentIds(scopes, user.departmentId)
    return departmentIds.length
      ? { user: { departmentId: { in: departmentIds } } }
      : { userId: user.id }
  }

  if (scopeTypes.includes('department') || scopeTypes.includes('department_tree') || scopeTypes.includes('direct_subordinates')) {
    return user.departmentId
      ? { user: { departmentId: user.departmentId } }
      : { userId: user.id }
  }

  return { userId: user.id }
}

export async function buildAttendanceDataScopeWhere(user: AuthUser) {
  const employeeWhere = await buildEmployeeDataScopeWhere(user)
  if (!Object.keys(employeeWhere).length) return {}
  return { employee: employeeWhere }
}
