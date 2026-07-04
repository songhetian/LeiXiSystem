import prisma from '../prisma'
import { getJSON, setJSON, invalidate } from '../utils/cache'
import {
  CACHE_TTL,
  departmentsTreeKey,
  payrollComponentsKey,
  type DepartmentTreeNode,
} from '../types/cache'

const FULL_DEPT_TREE_KEY = 'hr:org:departments:tree:full'

function buildDepartmentTree(departments: any[]): { tree: DepartmentTreeNode[]; map: Record<number, DepartmentTreeNode> } {
  const map: Record<number, DepartmentTreeNode> = {}
  const tree: DepartmentTreeNode[] = []

  departments.forEach(d => {
    map[d.id] = {
      id: d.id,
      name: d.name,
      parentId: d.parentId,
      managerId: d.managerId,
      sortOrder: d.sortOrder,
      children: [],
    }
  })

  departments.forEach(d => {
    const node = map[d.id]
    if (d.parentId && map[d.parentId]) {
      map[d.parentId].children!.push(node)
    } else {
      tree.push(node)
    }
  })

  const sortTree = (nodes: DepartmentTreeNode[]) => {
    nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    nodes.forEach(n => {
      if (n.children?.length) sortTree(n.children)
    })
  }
  sortTree(tree)

  return { tree, map }
}

export async function getDepartmentTree() {
  const key = departmentsTreeKey()
  const cached = await getJSON<{ tree: DepartmentTreeNode[]; map: Record<number, DepartmentTreeNode>; cachedAt: string }>(key)
  if (cached) {
    return cached
  }

  const departments = await prisma.department.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  const { tree, map } = buildDepartmentTree(departments)
  const result = { tree, map, cachedAt: new Date().toISOString() }
  await setJSON(key, result, CACHE_TTL.DEPARTMENTS_TREE)
  return result
}

export function invalidateDepartmentCache() {
  invalidate(departmentsTreeKey())
  invalidate(FULL_DEPT_TREE_KEY)
}

export async function getPayrollComponents() {
  const key = payrollComponentsKey()
  const cached = await getJSON<{ components: any[]; enabledComponents: number[]; cachedAt: string }>(key)
  if (cached) {
    return cached
  }

  const components = await prisma.salaryComponent.findMany({
    orderBy: { id: 'asc' },
  })

  const enabledComponents = components.filter(c => c.status === 'active').map(c => c.id)
  const result = { components, enabledComponents, cachedAt: new Date().toISOString() }
  await setJSON(key, result, CACHE_TTL.PAYROLL_COMPONENTS)
  return result
}

export function invalidatePayrollCache() {
  invalidate(payrollComponentsKey())
}

export async function warmupAll() {
  console.info('[CacheWarmup] 开始缓存预热...')
  const startTime = Date.now()
  let count = 0

  try {
    await getDepartmentTree()
    count++
    console.info('[CacheWarmup] 部门树缓存预热完成')
  } catch (err) {
    console.error('[CacheWarmup] 部门树缓存预热失败:', err instanceof Error ? err.message : String(err))
  }

  try {
    await getPayrollComponents()
    count++
    console.info('[CacheWarmup] 薪资组件缓存预热完成')
  } catch (err) {
    console.error('[CacheWarmup] 薪资组件缓存预热失败:', err instanceof Error ? err.message : String(err))
  }

  const elapsed = Date.now() - startTime
  console.info(`[CacheWarmup] 缓存预热完成，共 ${count} 项，耗时 ${elapsed}ms`)
}
