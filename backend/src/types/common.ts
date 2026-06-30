/**
 * 后端共享类型定义
 * 包含通用 DTO、分页、过滤参数等基础类型
 * 按模块组织，遵循 CONTEXT.md 命名规范
 */

// ============================================================
// 基础响应类型
// ============================================================

/**
 * 统一 API 响应包装
 * @template T - data 字段的类型
 */
export interface ApiResponse<T = any> {
  /** 状态码：0 表示成功，非 0 表示错误 */
  code: number
  /** 响应消息，成功时通常省略 */
  message?: string
  /** 业务数据 */
  data?: T
}

/**
 * 统一错误响应
 */
export interface ApiErrorResponse {
  code: number
  message: string
  /** 错误详情（仅开发环境） */
  details?: Record<string, string[]>
}

/**
 * 操作成功响应（无业务数据）
 */
export type ApiSuccessResponse = ApiResponse<null>

// ============================================================
// 分页类型
// ============================================================

/**
 * 分页查询基础参数
 */
export interface PaginationParams {
  /** 当前页码，从 1 开始 */
  page?: number
  /** 每页条数，默认 10 */
  pageSize?: number
}

/**
 * 分页元信息
 */
export interface PaginationMeta {
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 总条数 */
  total: number
  /** 总页数 */
  totalPages: number
}

/**
 * 分页列表响应（标准格式）
 * @template T - 列表项类型
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  list: T[]
  /** 分页元信息 */
  pagination: PaginationMeta
}

/**
 * 统一分页响应包装
 */
export interface ApiPaginatedResponse<T> {
  code: 0
  data: PaginatedResponse<T>
}

/**
 * 分页查询扩展参数（包含排序）
 */
export interface PaginatedQueryParams extends PaginationParams {
  /** 排序字段，格式：fieldName:asc 或 fieldName:desc */
  sortBy?: string
  /** 排序方向 */
  orderBy?: 'asc' | 'desc'
}

// ============================================================
// 日期范围查询
// ============================================================

/**
 * 日期范围查询参数
 */
export interface DateRangeParams {
  /** 开始日期（ISO 8601 格式） */
  startDate?: string
  /** 结束日期（ISO 8601 格式） */
  endDate?: string
}

/**
 * 基础列表查询参数（通用模板）
 */
export interface BaseListQueryParams extends PaginatedQueryParams {
  /** 关键词搜索（通常匹配 name/title/code 等字段） */
  keyword?: string
  /** 部门 ID */
  departmentId?: number
  /** 状态筛选 */
  status?: string
}

// ============================================================
// 批量操作类型
// ============================================================

/**
 * 批量删除请求
 */
export interface BatchDeleteRequest {
  /** 要删除的 ID 列表 */
  ids: number[]
}

/**
 * 批量状态更新请求
 */
export interface BatchStatusUpdateRequest {
  /** 要更新的 ID 列表 */
  ids: number[]
  /** 目标状态 */
  status: string
}

/**
 * 批量操作响应
 */
export interface BatchOperationResult {
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failedCount: number
  /** 失败的 ID 及错误信息 */
  failedItems?: Array<{ id: number; error: string }>
}

// ============================================================
// ID 参数
// ============================================================

/**
 * 路径参数：单个 ID
 */
export interface IdParam {
  /** 资源 ID */
  id: number
}

/**
 * 路径参数：多个 ID
 */
export interface IdsParam {
  /** 资源 ID 列表 */
  ids: number[]
}

// ============================================================
// 审计日志相关
// ============================================================

/**
 * 审计日志动作前缀（CONTEXT.md 规范：module.action 格式）
 */
export type AuditAction =
  | `leave.${'create' | 'update' | 'delete' | 'approve' | 'reject' | 'cancel'}`
  | `overtime.${'create' | 'update' | 'approve' | 'reject' | 'cancel'}`
  | `employee.${'create' | 'update' | 'delete'}`
  | `payroll.${'component' | 'structure' | 'assignment' | 'adjustment' | 'run'}.${string}`
  | `payslip.${'view' | 'confirm' | 'dispute' | 'recalculate' | 'withdraw'}`
  | `attendance.${'correction' | 'exception' | 'monthly' | 'calculate'}.${string}`
  | `recruitment.${'request' | 'opening' | 'candidate' | 'interview' | 'offer'}.${string}`
  | `performance.${'cycle' | 'goal' | 'review'}.${string}`
  | `helpdesk.${'ticket' | 'category' | 'comment'}.${string}`
  | `lifecycle.${'event' | 'onboarding' | 'offboarding'}.${string}`
  | `contract.${'create' | 'update' | 'delete'}`
  | `document.${'create' | 'update' | 'delete'}`
  | `contact.${'create' | 'update' | 'delete'}`
  | `asset.${'category' | 'item' | 'assignment'}.${string}`
  | `auth.${'login' | 'login.failed' | 'login.blocked' | 'logout'}`

/**
 * 审计日志创建参数
 */
export interface CreateAuditLogParams {
  /** 操作模块 */
  module: string
  /** 操作动作（点号分隔格式） */
  action: AuditAction
  /** 资源类型 */
  resourceType: string
  /** 资源 ID */
  resourceId?: number
  /** 操作人 ID */
  operatorId: number
  /** 操作人名称 */
  operatorName?: string
  /** 操作前数据（JSON 字符串） */
  beforeData?: Record<string, any> | null
  /** 操作后数据（JSON 字符串） */
  afterData?: Record<string, any> | null
  /** 请求 ID（用于链路追踪） */
  requestId?: string
  /** IP 地址 */
  ipAddress?: string
  /** 用户代理 */
  userAgent?: string
  /** 额外信息 */
  extra?: Record<string, any>
}

// ============================================================
// 通知相关
// ============================================================

/**
 * 通知类型枚举
 */
export type NotificationType = 'system' | 'approval' | 'reminder' | 'alert'

/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 创建通知参数
 */
export interface CreateNotificationParams {
  /** 通知类型 */
  type: NotificationType
  /** 通知标题 */
  title: string
  /** 通知内容 */
  content: string
  /** 接收人 ID */
  recipientId: number
  /** 优先级 */
  priority?: NotificationPriority
  /** 关联资源类型 */
  resourceType?: string
  /** 关联资源 ID */
  resourceId?: number
  /** 额外数据 */
  data?: Record<string, any>
  /** 过期时间 */
  expireAt?: Date
}

// ============================================================
// 导出相关
// ============================================================

/**
 * 导出格式枚举
 */
export type ExportFormat = 'xlsx' | 'csv' | 'pdf'

/**
 * 导出请求参数
 */
export interface ExportRequest {
  /** 导出格式 */
  format: ExportFormat
  /** 导出的字段列表 */
  fields?: string[]
  /** 文件名（不含扩展名） */
  filename?: string
  /** 查询参数（与列表接口一致） */
  query?: BaseListQueryParams
}

/**
 * 导出任务响应
 */
export interface ExportTaskResponse {
  /** 任务 ID */
  taskId: string
  /** 导出状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 下载链接（完成后） */
  downloadUrl?: string
  /** 预计剩余时间（秒） */
  estimatedTime?: number
}
