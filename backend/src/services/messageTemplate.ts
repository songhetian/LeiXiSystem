import prisma from '../prisma'

export interface TemplateVariable {
  name: string
  label: string
  defaultValue?: string
}

export function renderTemplate(content: string, variables: Record<string, any>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match
  })
}

export function extractTemplateVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g
  const variables: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }
  return variables
}

export async function getTemplateByCode(code: string) {
  return prisma.messageTemplate.findUnique({
    where: { code },
  })
}

export async function getTemplateList(params: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  keyword?: string
}) {
  const { page = 1, pageSize = 10, type, status, keyword } = params

  const where: any = {}
  if (type) where.type = type
  if (status) where.status = status
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { code: { contains: keyword } },
      { title: { contains: keyword } },
    ]
  }

  const [total, list] = await Promise.all([
    prisma.messageTemplate.count({ where }),
    prisma.messageTemplate.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, realName: true } },
      },
    }),
  ])

  return { total, list, page, pageSize }
}

export async function createTemplate(data: {
  name: string
  code: string
  type: string
  title: string
  content: string
  variables?: TemplateVariable[]
  isSystem?: boolean
  status?: string
  createdById: number
}) {
  return prisma.messageTemplate.create({
    data: {
      name: data.name,
      code: data.code,
      type: data.type,
      title: data.title,
      content: data.content,
      variables: data.variables as any,
      isSystem: data.isSystem || false,
      status: data.status || 'active',
      createdById: data.createdById,
    },
  })
}

export async function updateTemplate(
  id: number,
  data: {
    name?: string
    type?: string
    title?: string
    content?: string
    variables?: TemplateVariable[]
    status?: string
  }
) {
  return prisma.messageTemplate.update({
    where: { id },
    data: {
      ...data,
      variables: data.variables as any,
    },
  })
}

export async function deleteTemplate(id: number) {
  return prisma.messageTemplate.delete({ where: { id } })
}

export async function previewTemplate(
  templateId: number,
  variables: Record<string, any> = {}
) {
  const template = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
  })
  if (!template) throw new Error('模板不存在')

  const renderedTitle = renderTemplate(template.title, variables)
  const renderedContent = renderTemplate(template.content, variables)

  return {
    title: renderedTitle,
    content: renderedContent,
    originalTitle: template.title,
    originalContent: template.content,
  }
}
