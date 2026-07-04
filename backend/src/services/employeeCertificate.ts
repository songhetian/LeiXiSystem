import prisma from '../prisma'
import { HttpError } from '../utils/validation'

export interface CertificateFilter {
  status?: string
  type?: string
  keyword?: string
  employeeId?: number
  departmentId?: number
  startDate?: string
  endDate?: string
}

export interface CreateCertificateData {
  type: string
  title?: string
  purpose?: string
  language?: string
  needSeal?: boolean
  deliveryMethod?: string
  remark?: string
}

const certificateSelect = {
  id: true,
  employeeId: true,
  userId: true,
  type: true,
  title: true,
  purpose: true,
  language: true,
  needSeal: true,
  deliveryMethod: true,
  status: true,
  approverId: true,
  approvedAt: true,
  rejectReason: true,
  generatedAt: true,
  certificateUrl: true,
  remark: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeNo: true,
      user: {
        select: {
          id: true,
          realName: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
        },
      },
    },
  },
  user: {
    select: {
      id: true,
      realName: true,
    },
  },
  approver: {
    select: {
      id: true,
      realName: true,
    },
  },
}

export async function getMyRequests(
  userId: number,
  filter: CertificateFilter & { page?: number; pageSize?: number }
) {
  const { page = 1, pageSize = 10, status, type, startDate, endDate } = filter
  const skip = (page - 1) * pageSize
  const take = pageSize

  const where: any = { userId }
  if (status) where.status = status
  if (type) where.type = type
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59')
  }

  const [total, list] = await Promise.all([
    prisma.employeeCertificateRequest.count({ where }),
    prisma.employeeCertificateRequest.findMany({
      where,
      skip,
      take,
      select: certificateSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { list, total, page, pageSize }
}

export async function getRequests(
  filter: CertificateFilter & { page?: number; pageSize?: number }
) {
  const { page = 1, pageSize = 10, status, type, employeeId, keyword, startDate, endDate, departmentId } = filter
  const skip = (page - 1) * pageSize
  const take = pageSize

  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type
  if (employeeId) where.employeeId = employeeId
  if (keyword) {
    where.OR = [
      { employee: { user: { realName: { contains: keyword } } } },
      { title: { contains: keyword } },
      { purpose: { contains: keyword } },
    ]
  }
  if (departmentId) {
    where.employee = {
      ...where.employee,
      user: {
        ...where.employee?.user,
        departmentId,
      },
    }
  }
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59')
  }

  const [total, list] = await Promise.all([
    prisma.employeeCertificateRequest.count({ where }),
    prisma.employeeCertificateRequest.findMany({
      where,
      skip,
      take,
      select: certificateSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { list, total, page, pageSize }
}

export async function getRequest(id: number) {
  const request = await prisma.employeeCertificateRequest.findUnique({
    where: { id },
    select: certificateSelect,
  })

  if (!request) {
    throw new HttpError(404, '证明申请不存在')
  }

  return request
}

export async function createRequest(
  userId: number,
  employeeId: number,
  data: CreateCertificateData
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  })

  if (!employee) {
    throw new HttpError(404, '员工不存在')
  }

  if (employee.userId !== userId) {
    throw new HttpError(403, '无权为该员工创建申请')
  }

  const request = await prisma.employeeCertificateRequest.create({
    data: {
      employeeId,
      userId,
      type: data.type,
      title: data.title,
      purpose: data.purpose,
      language: data.language || 'zh-CN',
      needSeal: data.needSeal ?? true,
      deliveryMethod: data.deliveryMethod,
      remark: data.remark,
      status: 'pending',
    },
    select: certificateSelect,
  })

  return request
}

export async function approveRequest(id: number, approverId: number) {
  const request = await prisma.employeeCertificateRequest.findUnique({
    where: { id },
  })

  if (!request) {
    throw new HttpError(404, '证明申请不存在')
  }

  if (request.status !== 'pending') {
    throw new HttpError(400, '当前状态不允许审批')
  }

  const updated = await prisma.employeeCertificateRequest.update({
    where: { id },
    data: {
      status: 'approved',
      approverId,
      approvedAt: new Date(),
    },
    select: certificateSelect,
  })

  return updated
}

export async function rejectRequest(id: number, approverId: number, reason: string) {
  const request = await prisma.employeeCertificateRequest.findUnique({
    where: { id },
  })

  if (!request) {
    throw new HttpError(404, '证明申请不存在')
  }

  if (request.status !== 'pending') {
    throw new HttpError(400, '当前状态不允许审批')
  }

  const updated = await prisma.employeeCertificateRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      approverId,
      approvedAt: new Date(),
      rejectReason: reason,
    },
    select: certificateSelect,
  })

  return updated
}

export async function generateCertificate(id: number, url: string) {
  const request = await prisma.employeeCertificateRequest.findUnique({
    where: { id },
  })

  if (!request) {
    throw new HttpError(404, '证明申请不存在')
  }

  if (request.status !== 'approved') {
    throw new HttpError(400, '只有已通过的申请才能生成证明')
  }

  const updated = await prisma.employeeCertificateRequest.update({
    where: { id },
    data: {
      status: 'generated',
      certificateUrl: url,
      generatedAt: new Date(),
    },
    select: certificateSelect,
  })

  return updated
}

export async function cancelRequest(id: number, userId: number) {
  const request = await prisma.employeeCertificateRequest.findUnique({
    where: { id },
  })

  if (!request) {
    throw new HttpError(404, '证明申请不存在')
  }

  if (request.userId !== userId) {
    throw new HttpError(403, '无权取消该申请')
  }

  if (request.status !== 'pending') {
    throw new HttpError(400, '当前状态不允许取消')
  }

  await prisma.employeeCertificateRequest.delete({
    where: { id },
  })
}
