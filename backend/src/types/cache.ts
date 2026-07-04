/**
 * Redis 缓存类型定义
 * 遵循 CONTEXT.md 规范：Key 格式 hr:{module}:{entity}:{identifier}
 * TTL 单位：秒
 */

import type { FastifyInstance } from 'fastify'

// ============================================================
// 缓存 Key 规范
// ============================================================

/**
 * 缓存 Key 前缀常量
 */
export const CACHE_PREFIX = {
  /** RBAC 模块 */
  RBAC: 'hr:rbac',
  /** 组织架构模块 */
  ORG: 'hr:org',
  /** 考勤模块 */
  ATTENDANCE: 'hr:attendance',
  /** 薪资模块 */
  PAYROLL: 'hr:payroll',
  /** 系统配置模块 */
  CONFIG: 'hr:config',
  /** 会话管理 */
  SESSION: 'hr:session',
  /** WebSocket 模块 */
  WS: 'hr:ws',
} as const

/**
 * 缓存 Key 类型（模板字符串联合类型）
 */
export type CacheKeyTemplate =
  | `${typeof CACHE_PREFIX.RBAC}:permissions:user:${number}`
  | `${typeof CACHE_PREFIX.RBAC}:roles:list`
  | `${typeof CACHE_PREFIX.RBAC}:permissions:all`
  | `${typeof CACHE_PREFIX.ORG}:departments:tree`
  | `${typeof CACHE_PREFIX.ORG}:positions:list`
  | `${typeof CACHE_PREFIX.ORG}:employees:${number}`
  | `${typeof CACHE_PREFIX.ATTENDANCE}:daily:${number}:${string}`
  | `${typeof CACHE_PREFIX.ATTENDANCE}:monthly:${number}:${number}`
  | `${typeof CACHE_PREFIX.PAYROLL}:components:list`
  | `${typeof CACHE_PREFIX.PAYROLL}:structures:list`
  | `${typeof CACHE_PREFIX.CONFIG}:sys`
  | `${typeof CACHE_PREFIX.CONFIG}:vacation`
  | `${typeof CACHE_PREFIX.SESSION}:${string}`
  | `${typeof CACHE_PREFIX.WS}:online_users`
  | `${typeof CACHE_PREFIX.WS}:node:${string}:users`

// ============================================================
// TTL 常量（秒）
// ============================================================

/**
 * 缓存 TTL 配置（秒）
 */
export const CACHE_TTL = {
  /** 用户权限缓存：30 分钟 */
  USER_PERMISSIONS: 30 * 60,
  /** 角色列表缓存：1 小时 */
  ROLES_LIST: 60 * 60,
  /** 全部权限缓存：1 小时 */
  PERMISSIONS_ALL: 60 * 60,
  /** 部门树缓存：30 分钟 */
  DEPARTMENTS_TREE: 30 * 60,
  /** 职位列表缓存：30 分钟 */
  POSITIONS_LIST: 30 * 60,
  /** 员工详情缓存：15 分钟 */
  EMPLOYEE_DETAIL: 15 * 60,
  /** 日考勤结果缓存：24 小时 */
  ATTENDANCE_DAILY: 24 * 60 * 60,
  /** 月考勤结果缓存：1 小时 */
  ATTENDANCE_MONTHLY: 60 * 60,
  /** 薪资组件列表缓存：1 小时 */
  PAYROLL_COMPONENTS: 60 * 60,
  /** 薪资结构列表缓存：1 小时 */
  PAYROLL_STRUCTURES: 60 * 60,
  /** 系统配置缓存：永久（变更时主动失效） */
  SYSTEM_CONFIG: -1,
  /** 会话缓存：7 天 */
  SESSION: 7 * 24 * 60 * 60,
} as const

// ============================================================
// 缓存数据类型
// ============================================================

/**
 * 用户权限缓存数据
 */
export interface UserPermissionsCache {
  /** 用户 ID */
  userId: number
  /** 权限列表 */
  permissions: string[]
  /** 角色列表 */
  roles: string[]
  /** 数据范围 */
  dataScopes: {
    departmentId: number
    canViewAll: boolean
  }[]
  /** 缓存时间 */
  cachedAt: string
}

/**
 * 部门树缓存数据
 */
export interface DepartmentTreeCache {
  /** 部门树形结构 */
  tree: DepartmentTreeNode[]
  /** 扁平化部门映射 */
  map: Record<number, DepartmentTreeNode>
  /** 缓存时间 */
  cachedAt: string
}

/**
 * 部门树节点
 */
export interface DepartmentTreeNode {
  /** 部门 ID */
  id: number
  /** 部门名称 */
  name: string
  /** 父部门 ID */
  parentId: number | null
  /** 子部门 */
  children?: DepartmentTreeNode[]
  /** 部门经理 ID */
  managerId?: number
  /** 排序号 */
  sortOrder?: number
}

/**
 * 员工详情缓存数据
 */
export interface EmployeeDetailCache {
  /** 员工完整信息 */
  employee: {
    id: number
    employeeNo: string
    name: string
    departmentId: number
    departmentName: string
    positionId: number
    positionName: string
    status: string
    hireDate: string
    [key: string]: any
  }
  /** 假期余额 */
  vacationBalances?: {
    typeId: number
    typeName: string
    balance: number
    unit: string
  }[]
  /** 缓存时间 */
  cachedAt: string
}

/**
 * 日考勤缓存数据
 */
export interface AttendanceDailyCache {
  /** 员工 ID */
  employeeId: number
  /** 日期 */
  date: string
  /** 出勤天数 */
  workDays: number
  /** 实际出勤天数 */
  actualWorkDays: number
  /** 迟到次数 */
  lateCount: number
  /** 早退次数 */
  earlyLeaveCount: number
  /** 缺勤天数 */
  absentDays: number
  /** 加班天数 */
  overtimeDays: number
  /** 状态 */
  status: 'normal' | 'late' | 'absent' | 'leave' | 'overtime'
  /** 打卡记录 */
  checkinRecords?: {
    type: 'in' | 'out'
    time: string
    status: 'normal' | 'abnormal'
  }[]
  /** 缓存时间 */
  cachedAt: string
}

/**
 * 薪资组件缓存数据
 */
export interface PayrollComponentsCache {
  /** 组件列表 */
  components: {
    id: number
    name: string
    code: string
    type: string
    amountType: string
    formula: string | null
    taxable: boolean
    status: string
  }[]
  /** 启用的组件列表 */
  enabledComponents: number[]
  /** 缓存时间 */
  cachedAt: string
}

/**
 * 系统配置缓存数据
 */
export interface SystemConfigCache {
  /** 配置项 */
  config: Record<string, any>
  /** 版本号（用于乐观锁） */
  version: number
  /** 缓存时间 */
  cachedAt: string
}

// ============================================================
// 缓存操作接口
// ============================================================

/**
 * 缓存服务接口
 */
export interface ICacheService {
  /**
   * 获取缓存
   * @param key - 缓存 Key
   * @returns 缓存值（已反序列化），不存在返回 null
   */
  get<T = any>(key: string): Promise<T | null>

  /**
   * 设置缓存
   * @param key - 缓存 Key
   * @param value - 缓存值（将被 JSON 序列化）
   * @param ttl - 过期时间（秒），-1 表示永不过期
   */
  set(key: string, value: any, ttl?: number): Promise<void>

  /**
   * 删除缓存
   * @param key - 缓存 Key
   */
  del(key: string): Promise<void>

  /**
   * 批量删除缓存（支持通配符）
   * @param pattern - Key 模式，如 'hr:rbac:*'
   */
  delByPattern(pattern: string): Promise<void>

  /**
   * 判断 Key 是否存在
   * @param key - 缓存 Key
   */
  exists(key: string): Promise<boolean>

  /**
   * 设置过期时间
   * @param key - 缓存 Key
   * @param ttl - 过期时间（秒）
   */
  expire(key: string, ttl: number): Promise<void>

  /**
   * 获取过期时间
   * @param key - 缓存 Key
   * @returns 剩余过期时间（秒），-1 表示永不过期，-2 表示 Key 不存在
   */
  ttl(key: string): Promise<number>
}

// ============================================================
// 缓存 Key 生成函数
// ============================================================

/**
 * 生成用户权限缓存 Key
 */
export function userPermissionsKey(userId: number): string {
  return `${CACHE_PREFIX.RBAC}:permissions:user:${userId}`
}

/**
 * 生成部门树缓存 Key
 */
export function departmentsTreeKey(): string {
  return `${CACHE_PREFIX.ORG}:departments:tree`
}

/**
 * 生成员工详情缓存 Key
 */
export function employeeDetailKey(employeeId: number): string {
  return `${CACHE_PREFIX.ORG}:employees:${employeeId}`
}

/**
 * 生成日考勤缓存 Key
 */
export function attendanceDailyKey(employeeId: number, date: string): string {
  return `${CACHE_PREFIX.ATTENDANCE}:daily:${employeeId}:${date}`
}

/**
 * 生成月考勤缓存 Key
 */
export function attendanceMonthlyKey(employeeId: number, year: number): string {
  return `${CACHE_PREFIX.ATTENDANCE}:monthly:${employeeId}:${year}`
}

/**
 * 生成薪资组件缓存 Key
 */
export function payrollComponentsKey(): string {
  return `${CACHE_PREFIX.PAYROLL}:components:list`
}

/**
 * 缓存失效辅助函数
 */
export const cacheInvalidation = {
  /**
   * 使员工相关缓存失效
   * @param employeeId - 员工 ID
   */
  employee(employeeId: number): string[] {
    return [
      employeeDetailKey(employeeId),
      `${CACHE_PREFIX.ORG}:employees:${employeeId}`,
    ]
  },

  /**
   * 使部门相关缓存失效
   */
  department(): string[] {
    return [departmentsTreeKey(), `${CACHE_PREFIX.ORG}:positions:list`]
  },

  /**
   * 使权限相关缓存失效
   * @param userId - 用户 ID（可选，不传则使所有权限缓存失效）
   */
  permissions(userId?: number): string[] {
    if (userId) {
      return [userPermissionsKey(userId)]
    }
    return [
      userPermissionsKey(0).replace(':0', ':*'),
      `${CACHE_PREFIX.RBAC}:roles:list`,
      `${CACHE_PREFIX.RBAC}:permissions:all`,
    ]
  },

  /**
   * 使考勤相关缓存失效
   * @param employeeId - 员工 ID
   * @param date - 日期（可选）
   */
  attendance(employeeId: number, date?: string): string[] {
    if (date) {
      return [
        attendanceDailyKey(employeeId, date),
        attendanceMonthlyKey(employeeId, new Date(date).getFullYear()),
      ]
    }
    return [
      attendanceDailyKey(employeeId, date),
      `${CACHE_PREFIX.ATTENDANCE}:monthly:${employeeId}:*`,
    ]
  },

  /**
   * 使薪资相关缓存失效
   */
  payroll(): string[] {
    return [
      payrollComponentsKey(),
      `${CACHE_PREFIX.PAYROLL}:structures:list`,
    ]
  },
}

// ============================================================
// WebSocket 相关 Key 生成函数
// ============================================================

/**
 * WebSocket 频道常量
 */
export const WS_CHANNEL = {
  /** 消息推送频道 */
  PUSH: 'hr:ws:push',
  /** 在线状态同步频道 */
  STATUS: 'hr:ws:status',
} as const

/**
 * 生成全局在线用户集合 Key
 */
export function wsOnlineUsersKey(): string {
  return `${CACHE_PREFIX.WS}:online_users`
}

/**
 * 生成节点在线用户集合 Key
 */
export function wsNodeUsersKey(nodeId: string): string {
  return `${CACHE_PREFIX.WS}:node:${nodeId}:users`
}
