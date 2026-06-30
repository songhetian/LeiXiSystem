import prisma from '../prisma'

export interface CreateApprovalRecordInput {
  requestType: 'leave' | 'overtime' | 'reimbursement' | 'attendance_correction' | 'schedule_appeal' | string
  requestId: number
  nodeId?: number
  nodeOrder: number
  nodeName?: string
  approverId?: number
  approverName?: string
  action: 'approve' | 'reject' | 'submit' | 'cancel' | string
  opinion?: string
}

export async function createApprovalRecord(input: CreateApprovalRecordInput) {
  const record = await prisma.approvalRecord.create({
    data: {
      requestType: input.requestType,
      requestId: input.requestId,
      nodeId: input.nodeId,
      nodeOrder: input.nodeOrder,
      nodeName: input.nodeName,
      approverId: input.approverId,
      approverName: input.approverName,
      action: input.action,
      opinion: input.opinion,
    },
  })
  return record
}

export async function getApprovalRecords(requestType: string, requestId: number) {
  return prisma.approvalRecord.findMany({
    where: { requestType, requestId },
    orderBy: { nodeOrder: 'asc' },
  })
}

export async function getApprovalRecordsByApprover(approverId: number, options?: { status?: string; requestType?: string; page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 20, status, requestType } = options || {}
  const skip = (page - 1) * pageSize

  const where: any = { approverId }
  if (requestType) where.requestType = requestType

  const [total, list] = await Promise.all([
    prisma.approvalRecord.count({ where }),
    prisma.approvalRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { total, list, page, pageSize }
}
