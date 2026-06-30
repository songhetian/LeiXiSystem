import prisma from '../prisma'
import type { AuthUser } from '../types/fastify'
import { buildEmployeeDataScopeWhere } from './dataScope'

function isSuperAdmin(user: AuthUser) {
  return user.roles.includes('超级管理员') || user.permissions.includes('*')
}

function hasAnyPermission(user: AuthUser, permissions: string[]) {
  return permissions.some((p) => user.permissions.includes(p))
}

interface EmployeeAccessCheckOptions {
  adminPermissions?: string[]
  allowSelf?: boolean
}

export async function canAccessEmployee(
  user: AuthUser,
  employeeId: number,
  options: EmployeeAccessCheckOptions = {},
): Promise<boolean> {
  const { adminPermissions = [], allowSelf = true } = options

  if (isSuperAdmin(user)) {
    return true
  }

  if (adminPermissions.length > 0 && hasAnyPermission(user, adminPermissions)) {
    return true
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { userId: true },
  })

  if (!employee) {
    return false
  }

  if (allowSelf && employee.userId === user.id) {
    return true
  }

  const scopeWhere = await buildEmployeeDataScopeWhere(user)
  if (Object.keys(scopeWhere).length === 0) {
    return true
  }

  const inScope = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      ...scopeWhere,
    },
    select: { id: true },
  })

  return Boolean(inScope)
}

export async function canAccessEmployeeByUserId(
  user: AuthUser,
  targetUserId: number,
  options: EmployeeAccessCheckOptions = {},
): Promise<boolean> {
  const { adminPermissions = [], allowSelf = true } = options

  if (isSuperAdmin(user)) {
    return true
  }

  if (adminPermissions.length > 0 && hasAnyPermission(user, adminPermissions)) {
    return true
  }

  if (allowSelf && targetUserId === user.id) {
    return true
  }

  const scopeWhere = await buildEmployeeDataScopeWhere(user)
  if (Object.keys(scopeWhere).length === 0) {
    return true
  }

  const inScope = await prisma.employee.findFirst({
    where: {
      userId: targetUserId,
      ...scopeWhere,
    },
    select: { id: true },
  })

  return Boolean(inScope)
}

export async function getAccessibleEmployee<T>(
  user: AuthUser,
  employeeFinder: () => Promise<T | null>,
  getEmployeeId: (employee: T) => number,
  options: EmployeeAccessCheckOptions = {},
): Promise<T | null> {
  const employee = await employeeFinder()
  if (!employee) {
    return null
  }

  const employeeId = getEmployeeId(employee)
  const canAccess = await canAccessEmployee(user, employeeId, options)
  if (!canAccess) {
    return null
  }

  return employee
}

export async function getAccessiblePayslip<T>(
  user: AuthUser,
  payslipFinder: () => Promise<T | null>,
  getPayslipEmployeeId: (payslip: T) => number,
  options: EmployeeAccessCheckOptions = {},
): Promise<T | null> {
  const payslip = await payslipFinder()
  if (!payslip) {
    return null
  }

  const employeeId = getPayslipEmployeeId(payslip)
  const canAccess = await canAccessEmployee(user, employeeId, options)
  if (!canAccess) {
    return null
  }

  return payslip
}

interface ApprovalRecord {
  approverId: number
  action: string
}

interface ApprovalDocument {
  userId: number
  status: string
  currentStep: number
  approvalRecords: ApprovalRecord[]
}

function isApprovalDocumentAccessible(
  user: AuthUser,
  doc: ApprovalDocument,
  adminPermissions: string[],
): boolean {
  if (isSuperAdmin(user)) {
    return true
  }

  if (adminPermissions.length > 0 && hasAnyPermission(user, adminPermissions)) {
    return true
  }

  if (doc.userId === user.id) {
    return true
  }

  if (doc.status === 'pending') {
    const isApprover = doc.approvalRecords.some(
      (r) => r.approverId === user.id,
    )
    if (isApprover) {
      return true
    }
  }

  return false
}

export async function canAccessReimbursement(
  user: AuthUser,
  reimbursementId: number,
): Promise<boolean> {
  const reimbursement = await prisma.reimbursement.findUnique({
    where: { id: reimbursementId },
    select: {
      userId: true,
      status: true,
      currentStep: true,
      approvalRecords: {
        select: { approverId: true, action: true },
      },
    },
  })

  if (!reimbursement) {
    return false
  }

  return isApprovalDocumentAccessible(
    user,
    reimbursement,
    ['reimbursement:approve', 'reimbursement:view'],
  )
}

export async function getAccessibleReimbursement<T>(
  user: AuthUser,
  finder: () => Promise<T | null>,
  getId: (item: T) => number,
): Promise<T | null> {
  const item = await finder()
  if (!item) {
    return null
  }

  const canAccess = await canAccessReimbursement(user, getId(item))
  if (!canAccess) {
    return null
  }

  return item
}

export async function canAccessLeaveRequest(
  user: AuthUser,
  leaveId: number,
): Promise<boolean> {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: {
      userId: true,
      status: true,
      currentStep: true,
      approvalRecords: {
        select: { approverId: true, action: true },
      },
    },
  })

  if (!leave) {
    return false
  }

  return isApprovalDocumentAccessible(
    user,
    leave,
    ['approval:view', 'vacation:manage'],
  )
}

export async function getAccessibleLeaveRequest<T>(
  user: AuthUser,
  finder: () => Promise<T | null>,
  getId: (item: T) => number,
): Promise<T | null> {
  const item = await finder()
  if (!item) {
    return null
  }

  const canAccess = await canAccessLeaveRequest(user, getId(item))
  if (!canAccess) {
    return null
  }

  return item
}

export async function canAccessOvertimeRequest(
  user: AuthUser,
  overtimeId: number,
): Promise<boolean> {
  const overtime = await prisma.overtimeRequest.findUnique({
    where: { id: overtimeId },
    select: {
      userId: true,
      status: true,
      currentStep: true,
    },
  })

  if (!overtime) {
    return false
  }

  if (isSuperAdmin(user)) {
    return true
  }

  if (hasAnyPermission(user, ['approval:view', 'attendance:calculate'])) {
    return true
  }

  if (overtime.userId === user.id) {
    return true
  }

  return false
}

export async function getAccessibleOvertimeRequest<T>(
  user: AuthUser,
  finder: () => Promise<T | null>,
  getId: (item: T) => number,
): Promise<T | null> {
  const item = await finder()
  if (!item) {
    return null
  }

  const canAccess = await canAccessOvertimeRequest(user, getId(item))
  if (!canAccess) {
    return null
  }

  return item
}

export async function canAccessAsset(
  user: AuthUser,
  assetId: number,
): Promise<boolean> {
  const asset = await prisma.assetItem.findUnique({
    where: { id: assetId },
    select: {
      currentEmployeeId: true,
    },
  })

  if (!asset) {
    return false
  }

  if (isSuperAdmin(user)) {
    return true
  }

  if (hasAnyPermission(user, ['asset:manage', 'asset:view', 'asset:assign'])) {
    return true
  }

  if (asset.currentEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: asset.currentEmployeeId },
      select: { userId: true },
    })
    if (employee && employee.userId === user.id) {
      return true
    }
  }

  return false
}

export async function getAccessibleAsset<T>(
  user: AuthUser,
  finder: () => Promise<T | null>,
  getId: (item: T) => number,
): Promise<T | null> {
  const item = await finder()
  if (!item) {
    return null
  }

  const canAccess = await canAccessAsset(user, getId(item))
  if (!canAccess) {
    return null
  }

  return item
}

export async function canAccessHelpdeskTicket(
  user: AuthUser,
  ticketId: number,
): Promise<boolean> {
  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id: ticketId },
    select: {
      createdBy: true,
      assignedTo: true,
    },
  })

  if (!ticket) {
    return false
  }

  if (isSuperAdmin(user)) {
    return true
  }

  if (hasAnyPermission(user, ['helpdesk:manage', 'helpdesk:handle'])) {
    return true
  }

  if (ticket.createdBy === user.id) {
    return true
  }

  if (ticket.assignedTo === user.id) {
    return true
  }

  return false
}

export async function getAccessibleHelpdeskTicket<T>(
  user: AuthUser,
  finder: () => Promise<T | null>,
  getId: (item: T) => number,
): Promise<T | null> {
  const item = await finder()
  if (!item) {
    return null
  }

  const canAccess = await canAccessHelpdeskTicket(user, getId(item))
  if (!canAccess) {
    return null
  }

  return item
}
