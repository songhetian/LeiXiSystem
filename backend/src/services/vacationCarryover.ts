import prisma from '../prisma'
import { Prisma, VacationType } from '@prisma/client'

export type CarryoverOptions = {
  employeeIds?: number[]
  vacationTypeIds?: number[]
  operatorId?: number
  expireMonths?: number
}

export type CarryoverFilter = {
  employeeId?: number
  vacationTypeId?: number
  fromYear?: number
  toYear?: number
  status?: string
  page?: number
  pageSize?: number
}

export type CarryoverResult = {
  totalEmployees: number
  totalRecords: number
  totalCarriedDays: number
  totalExpiredDays: number
  records: Array<{
    id: number
    employeeId: number
    employeeName?: string
    employeeNo?: string
    vacationTypeId: number
    vacationTypeName?: string
    fromYear: number
    toYear: number
    carriedDays: number
    expiredDays: number
    expireDate?: Date | null
    status: string
    createdAt: Date
  }>
}

function toNumber(value: string | number | Prisma.Decimal): number {
  return Number(value)
}

export function calculateCarryoverAmount(
  balance: number,
  vacationType: Pick<VacationType, 'isCarryOver' | 'carryOverDays'>
): number {
  if (!vacationType.isCarryOver) {
    return 0
  }
  const maxCarryOver = toNumber(vacationType.carryOverDays)
  return Math.min(balance, maxCarryOver)
}

export async function carryoverVacation(
  fromYear: number,
  toYear: number,
  options: CarryoverOptions = {}
): Promise<CarryoverResult> {
  const { employeeIds, vacationTypeIds, operatorId, expireMonths = 12 } = options

  const carryoverTypes = await prisma.vacationType.findMany({
    where: {
      isCarryOver: true,
      status: 'active',
      ...(vacationTypeIds && vacationTypeIds.length > 0 ? { id: { in: vacationTypeIds } } : {}),
    },
  })

  if (carryoverTypes.length === 0) {
    return {
      totalEmployees: 0,
      totalRecords: 0,
      totalCarriedDays: 0,
      totalExpiredDays: 0,
      records: [],
    }
  }

  const typeIds = carryoverTypes.map((t) => t.id)

  const employees = await prisma.employee.findMany({
    where: {
      status: 'active',
      ...(employeeIds && employeeIds.length > 0 ? { id: { in: employeeIds } } : {}),
    },
    include: { user: true },
  })

  if (employees.length === 0) {
    return {
      totalEmployees: 0,
      totalRecords: 0,
      totalCarriedDays: 0,
      totalExpiredDays: 0,
      records: [],
    }
  }

  const empIds = employees.map((e) => e.id)

  const existingRecords = await prisma.vacationCarryoverRecord.findMany({
    where: {
      employeeId: { in: empIds },
      vacationTypeId: { in: typeIds },
      fromYear,
      toYear,
    },
  })

  const existingSet = new Set(
    existingRecords.map((r) => `${r.employeeId}-${r.vacationTypeId}-${fromYear}-${toYear}`)
  )

  const fromBalances = await prisma.vacationBalance.findMany({
    where: {
      employeeId: { in: empIds },
      vacationTypeId: { in: typeIds },
      year: fromYear,
    },
    include: { vacationType: true },
  })

  const result: CarryoverResult = {
    totalEmployees: employees.length,
    totalRecords: 0,
    totalCarriedDays: 0,
    totalExpiredDays: 0,
    records: [],
  }

  const expireDate = new Date(toYear, expireMonths - 1, 31)

  const createdRecords: Array<{
    employeeId: number
    vacationTypeId: number
    fromYear: number
    toYear: number
    carriedDays: number
    expiredDays: number
    expireDate: Date
    status: string
    operatorId?: number
  }> = []

  const balanceUpdates: Array<{
    employeeId: number
    vacationTypeId: number
    year: number
    total: number
    used: number
    balance: number
  }> = []

  const balanceCreates: Array<{
    employeeId: number
    vacationTypeId: number
    year: number
    total: number
    used: number
    balance: number
  }> = []

  for (const balance of fromBalances) {
    const key = `${balance.employeeId}-${balance.vacationTypeId}-${fromYear}-${toYear}`
    if (existingSet.has(key)) {
      continue
    }

    const currentBalance = toNumber(balance.balance)
    const carryoverDays = calculateCarryoverAmount(currentBalance, balance.vacationType)
    const expiredDays = currentBalance - carryoverDays

    if (carryoverDays <= 0 && expiredDays <= 0) {
      continue
    }

    createdRecords.push({
      employeeId: balance.employeeId,
      vacationTypeId: balance.vacationTypeId,
      fromYear,
      toYear,
      carriedDays: carryoverDays,
      expiredDays,
      expireDate,
      status: carryoverDays > 0 ? 'active' : 'expired',
      operatorId,
    })

    const toBalance = await prisma.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId: balance.employeeId,
          vacationTypeId: balance.vacationTypeId,
          year: toYear,
        },
      },
    })

    if (toBalance) {
      const newTotal = toNumber(toBalance.total) + carryoverDays
      const newBalance = toNumber(toBalance.balance) + carryoverDays
      balanceUpdates.push({
        employeeId: balance.employeeId,
        vacationTypeId: balance.vacationTypeId,
        year: toYear,
        total: newTotal,
        used: toNumber(toBalance.used),
        balance: newBalance,
      })
    } else {
      balanceCreates.push({
        employeeId: balance.employeeId,
        vacationTypeId: balance.vacationTypeId,
        year: toYear,
        total: carryoverDays,
        used: 0,
        balance: carryoverDays,
      })
    }

    result.totalCarriedDays += carryoverDays
    result.totalExpiredDays += expiredDays
  }

  if (createdRecords.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.vacationCarryoverRecord.createMany({
        data: createdRecords.map((r) => ({
          ...r,
          carriedDays: new Prisma.Decimal(r.carriedDays),
          expiredDays: new Prisma.Decimal(r.expiredDays),
        })),
      })

      for (const update of balanceUpdates) {
        await tx.vacationBalance.update({
          where: {
            employeeId_vacationTypeId_year: {
              employeeId: update.employeeId,
              vacationTypeId: update.vacationTypeId,
              year: update.year,
            },
          },
          data: {
            total: new Prisma.Decimal(update.total),
            balance: new Prisma.Decimal(update.balance),
          },
        })
      }

      for (const create of balanceCreates) {
        await tx.vacationBalance.create({
          data: {
            employeeId: create.employeeId,
            vacationTypeId: create.vacationTypeId,
            year: create.year,
            total: new Prisma.Decimal(create.total),
            used: new Prisma.Decimal(create.used),
            balance: new Prisma.Decimal(create.balance),
          },
        })
      }
    })
  }

  result.totalRecords = createdRecords.length

  const newRecords = await prisma.vacationCarryoverRecord.findMany({
    where: {
      employeeId: { in: empIds },
      vacationTypeId: { in: typeIds },
      fromYear,
      toYear,
    },
    include: {
      employee: { include: { user: true } },
      vacationType: true,
    },
    orderBy: [{ employeeId: 'asc' }, { vacationTypeId: 'asc' }],
  })

  result.records = newRecords.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.user?.realName,
    employeeNo: r.employee.employeeNo,
    vacationTypeId: r.vacationTypeId,
    vacationTypeName: r.vacationType.name,
    fromYear: r.fromYear,
    toYear: r.toYear,
    carriedDays: toNumber(r.carriedDays),
    expiredDays: toNumber(r.expiredDays),
    expireDate: r.expireDate,
    status: r.status,
    createdAt: r.createdAt,
  }))

  return result
}

export async function getCarryoverRecords(filter: CarryoverFilter = {}) {
  const { employeeId, vacationTypeId, fromYear, toYear, status, page = 1, pageSize = 20 } = filter

  const where: Prisma.VacationCarryoverRecordWhereInput = {}

  if (employeeId) {
    where.employeeId = employeeId
  }
  if (vacationTypeId) {
    where.vacationTypeId = vacationTypeId
  }
  if (fromYear) {
    where.fromYear = fromYear
  }
  if (toYear) {
    where.toYear = toYear
  }
  if (status) {
    where.status = status
  }

  const [total, records] = await Promise.all([
    prisma.vacationCarryoverRecord.count({ where }),
    prisma.vacationCarryoverRecord.findMany({
      where,
      include: {
        employee: { include: { user: true } },
        vacationType: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    total,
    page,
    pageSize,
    list: records.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.user?.realName,
      employeeNo: r.employee.employeeNo,
      vacationTypeId: r.vacationTypeId,
      vacationTypeName: r.vacationType.name,
      fromYear: r.fromYear,
      toYear: r.toYear,
      carriedDays: toNumber(r.carriedDays),
      expiredDays: toNumber(r.expiredDays),
      expireDate: r.expireDate,
      status: r.status,
      operatorId: r.operatorId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  }
}

export async function expireCarryoverRecords(date: Date = new Date()) {
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  const activeRecords = await prisma.vacationCarryoverRecord.findMany({
    where: {
      status: 'active',
      expireDate: {
        lte: targetDate,
      },
    },
    include: {
      employee: true,
      vacationType: true,
    },
  })

  if (activeRecords.length === 0) {
    return {
      expiredCount: 0,
      totalExpiredDays: 0,
    }
  }

  let totalExpiredDays = 0

  await prisma.$transaction(async (tx) => {
    for (const record of activeRecords) {
      const remainDays = toNumber(record.carriedDays) - toNumber(record.expiredDays)

      if (remainDays <= 0) {
        await tx.vacationCarryoverRecord.update({
          where: { id: record.id },
          data: { status: 'expired' },
        })
        continue
      }

      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId: record.employeeId,
            vacationTypeId: record.vacationTypeId,
            year: record.toYear,
          },
        },
      })

      if (balance) {
        const currentBalance = toNumber(balance.balance)
        const deductDays = Math.min(remainDays, currentBalance)
        const newBalance = Math.max(0, currentBalance - deductDays)
        const newTotal = Math.max(0, toNumber(balance.total) - deductDays)

        await tx.vacationBalance.update({
          where: { id: balance.id },
          data: {
            total: new Prisma.Decimal(newTotal),
            balance: new Prisma.Decimal(newBalance),
          },
        })

        totalExpiredDays += deductDays
      }

      await tx.vacationCarryoverRecord.update({
        where: { id: record.id },
        data: {
          status: 'expired',
          expiredDays: new Prisma.Decimal(toNumber(record.carriedDays)),
        },
      })
    }
  })

  return {
    expiredCount: activeRecords.length,
    totalExpiredDays,
  }
}
