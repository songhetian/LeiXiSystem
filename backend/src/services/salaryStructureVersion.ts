import prisma from '../prisma'
import { Prisma, SalaryStructureVersion } from '@prisma/client'

interface CreateVersionData {
  versionName?: string
  effectiveFrom: string
  effectiveTo?: string | null
  changeReason?: string
}

interface VersionFilter {
  isCurrent?: boolean
}

export async function createVersion(structureId: number, data: CreateVersionData, createdBy?: number) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { id: structureId },
    include: { items: { include: { component: true }, orderBy: { sortOrder: 'asc' } } },
  })

  if (!structure) {
    throw new Error('薪资结构不存在')
  }

  const lastVersion = await prisma.salaryStructureVersion.findFirst({
    where: { structureId },
    orderBy: { version: 'desc' },
  })

  const nextVersion = (lastVersion?.version || 0) + 1

  const componentsSnapshot = structure.items.map((item) => ({
    id: item.id,
    componentId: item.componentId,
    componentName: item.component.name,
    componentCode: item.component.code,
    componentType: item.component.type,
    amount: item.amount ? Number(item.amount) : null,
    formula: item.formula,
    condition: item.condition,
    sortOrder: item.sortOrder,
  }))

  const version = await prisma.$transaction(async (tx) => {
    await tx.salaryStructureVersion.updateMany({
      where: { structureId, isCurrent: true },
      data: { isCurrent: false },
    })

    return tx.salaryStructureVersion.create({
      data: {
        structureId,
        version: nextVersion,
        versionName: data.versionName,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        isCurrent: true,
        changeReason: data.changeReason,
        components: componentsSnapshot as Prisma.InputJsonValue,
        createdBy,
      },
    })
  })

  return version
}

export async function getVersions(structureId: number, filter?: VersionFilter) {
  const where: Prisma.SalaryStructureVersionWhereInput = { structureId }

  if (filter?.isCurrent !== undefined) {
    where.isCurrent = filter.isCurrent
  }

  return prisma.salaryStructureVersion.findMany({
    where,
    orderBy: { version: 'desc' },
  })
}

export async function getVersion(id: number) {
  return prisma.salaryStructureVersion.findUnique({
    where: { id },
  })
}

export async function activateVersion(id: number) {
  const version = await prisma.salaryStructureVersion.findUnique({
    where: { id },
  })

  if (!version) {
    throw new Error('版本不存在')
  }

  return prisma.$transaction(async (tx) => {
    await tx.salaryStructureVersion.updateMany({
      where: { structureId: version.structureId, isCurrent: true },
      data: { isCurrent: false },
    })

    return tx.salaryStructureVersion.update({
      where: { id },
      data: { isCurrent: true },
    })
  })
}

export async function getCurrentVersion(structureId: number) {
  return prisma.salaryStructureVersion.findFirst({
    where: { structureId, isCurrent: true },
  })
}

export async function getVersionForDate(structureId: number, date: Date) {
  return prisma.salaryStructureVersion.findFirst({
    where: {
      structureId,
      effectiveFrom: { lte: date },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: date } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  })
}
