import prisma from '../prisma'

export type ApproverType =
  | 'direct_superior'
  | 'role'
  | 'person'
  | 'dept_head'
  | 'applicant'

export interface ResolveApproverParams {
  employeeId: number
  approverType: ApproverType
  approverValue?: string
}

export interface ResolvedApprover {
  userId: number
  userName: string
  employeeId: number
  source: string
}

async function getDeptManagerByEmployee(employeeId: number): Promise<ResolvedApprover | null> {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: { select: { departmentId: true } },
    },
  })
  if (!emp?.user?.departmentId) return null

  const dept = await prisma.department.findUnique({
    where: { id: emp.user.departmentId },
    include: {
      manager: {
        select: {
          id: true,
          realName: true,
          employee: { select: { id: true } },
        },
      },
    },
  })
  if (!dept?.manager) return null

  return {
    userId: dept.manager.id,
    userName: dept.manager.realName,
    employeeId: dept.manager.employee?.id || 0,
    source: '部门负责人',
  }
}

export async function resolveApprover(
  params: ResolveApproverParams,
): Promise<ResolvedApprover | null> {
  const { employeeId, approverType, approverValue } = params

  switch (approverType) {
    case 'direct_superior': {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          supervisor: {
            include: {
              user: { select: { id: true, realName: true } },
            },
          },
        },
      })
      if (emp?.supervisor?.user) {
        return {
          userId: emp.supervisor.user.id,
          userName: emp.supervisor.user.realName,
          employeeId: emp.supervisor.id,
          source: '直属上级',
        }
      }
      const deptManager = await getDeptManagerByEmployee(employeeId)
      return deptManager
    }

    case 'dept_head': {
      return getDeptManagerByEmployee(employeeId)
    }

    case 'role': {
      if (!approverValue) return null
      let roleId: number | undefined
      let roleName: string | undefined
      try {
        const parsed = JSON.parse(approverValue)
        roleId = parsed.id
        roleName = parsed.name
      } catch {
        return null
      }
      if (!roleId) return null

      const userRole = await prisma.userRole.findFirst({
        where: { roleId },
        include: {
          user: {
            select: {
              id: true,
              realName: true,
              employee: { select: { id: true } },
            },
          },
        },
      })
      if (!userRole?.user) return null

      return {
        userId: userRole.user.id,
        userName: userRole.user.realName,
        employeeId: userRole.user.employee?.id || 0,
        source: roleName ? `角色：${roleName}` : '指定角色',
      }
    }

    case 'person': {
      if (!approverValue) return null
      let empId: number | undefined
      let empName: string | undefined
      try {
        const parsed = JSON.parse(approverValue)
        empId = parsed.id
        empName = parsed.name
      } catch {
        return null
      }
      if (!empId) return null

      const emp = await prisma.employee.findUnique({
        where: { id: empId },
        include: { user: { select: { id: true, realName: true } } },
      })
      if (!emp?.user) return null

      return {
        userId: emp.user.id,
        userName: emp.user.realName,
        employeeId: emp.id,
        source: empName ? `指定人员：${empName}` : '指定人员',
      }
    }

    case 'applicant': {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { user: { select: { id: true, realName: true } } },
      })
      if (!emp?.user) return null
      return {
        userId: emp.user.id,
        userName: emp.user.realName,
        employeeId: emp.id,
        source: '申请人',
      }
    }

    default:
      return null
  }
}

export async function resolveApproversFromWorkflow(
  employeeId: number,
  flowId: number,
): Promise<Array<{
  nodeId: number
  nodeOrder: number
  nodeName: string
  approver: ResolvedApprover | null
}>> {
  const flow = await prisma.approvalWorkflow.findUnique({
    where: { id: flowId },
    include: {
      nodes: {
        orderBy: { nodeOrder: 'asc' },
      },
    },
  })
  if (!flow) return []

  const result = []
  for (const node of flow.nodes) {
    let approverValue: string | undefined
    if (node.approverType === 'role' && node.roleId) {
      approverValue = JSON.stringify({ id: node.roleId })
    } else if (node.approverType === 'person' && node.approverId) {
      approverValue = JSON.stringify({ id: node.approverId })
    }

    const approver = await resolveApprover({
      employeeId,
      approverType: (node.approverType as ApproverType) || 'direct_superior',
      approverValue,
    })
    result.push({
      nodeId: node.id,
      nodeOrder: node.nodeOrder,
      nodeName: node.nodeName,
      approver,
    })
  }
  return result
}
