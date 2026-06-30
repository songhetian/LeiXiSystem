/**
 * 前端共享类型定义
 * 包含通用 API 响应类型、组件 Props、表格类型、表单类型等
 * 遵循 CONTEXT.md 命名规范，使用严格 TypeScript
 */

// ============================================================
// 基础类型别名
// ============================================================

/** ISO 8601 日期字符串 */
export type DateString = string

/** ISO 8601 日期时间字符串 */
export type DateTimeString = string

/** 雪花 ID 或 UUID */
export type Id = number | string

// ============================================================
// API 响应类型
// ============================================================

/**
 * 统一 API 响应包装
 */
export interface ApiResponse<T = any> {
  /** 状态码：0 表示成功，非 0 表示错误 */
  code: number
  /** 响应消息 */
  message?: string
  /** 业务数据 */
  data?: T
}

/**
 * 操作成功响应
 */
export type ApiSuccess = ApiResponse<null>

/**
 * 分页列表响应（标准格式）
 * @template T - 列表项类型
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  list: T[]
  /** 总条数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
}

/**
 * 统一分页响应包装
 */
export interface ApiPaginatedResponse<T> {
  code: 0
  data: PaginatedResponse<T>
}

/**
 * 导出任务响应
 */
export interface ExportTaskResponse {
  /** 任务 ID */
  taskId: string
  /** 任务状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 下载链接 */
  downloadUrl?: string
  /** 预计剩余时间（秒） */
  estimatedTime?: number
}

// ============================================================
// 分页参数
// ============================================================

/**
 * 分页参数
 */
export interface PaginationParams {
  /** 当前页码，从 1 开始 */
  page?: number
  /** 每页条数，默认 10 */
  pageSize?: number
}

/**
 * 分页状态（用于 React state）
 */
export interface PaginationState extends PaginationParams {
  /** 总条数 */
  total?: number
}

// ============================================================
// 基础查询参数
// ============================================================

/**
 * 基础列表查询参数
 */
export interface ListQueryParams extends PaginationParams {
  /** 关键词搜索 */
  keyword?: string
  /** 部门 ID */
  departmentId?: number
  /** 状态筛选 */
  status?: string
  /** 开始日期 */
  startDate?: string
  /** 结束日期 */
  endDate?: string
}

/**
 * 排序参数
 */
export interface SortParams {
  /** 排序字段 */
  sortBy?: string
  /** 排序方向 */
  orderBy?: 'asc' | 'desc'
}

// ============================================================
// 表格类型
// ============================================================

/**
 * 表格列定义
 * @template T - 行数据类型
 */
export interface TableColumn<T = any> {
  /** 数据字段 */
  dataIndex: string
  /** 列标题 */
  title: string
  /** 列宽 */
  width?: number | string
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
  /** 是否可排序 */
  sortable?: boolean
  /** 是否可固定 */
  fixed?: 'left' | 'right'
  /** 渲染函数 */
  render?: (value: any, record: T, index: number) => React.ReactNode
  /** 自定义过滤 */
  filters?: Array<{ text: string; value: string }>
  /** 是否支持过滤 */
  filterable?: boolean
}

/**
 * 表格选择配置
 */
export interface TableSelection {
  /** 是否显示选择框 */
  type?: 'checkbox' | 'radio'
  /** 选中的 Key 列表（受控） */
  selectedRowKeys?: Id[]
  /** 选择变化回调 */
  onChange?: (selectedRowKeys: Id[], selectedRows: any[]) => void
}

/**
 * 表格行类型
 * @description 扩展行数据类型，添加 id 属性
 */
export type TableRow<T = any> = T & {
  /** 行唯一标识 */
  id: Id
}

/**
 * 表格操作列配置
 */
export interface TableAction<T = any> {
  /** 操作名称 */
  label: string
  /** 是否禁用 */
  disabled?: boolean
  /** 危险操作标记 */
  danger?: boolean
  /** 点击回调 */
  onClick?: (record: T) => void
}

// ============================================================
// 表单类型
// ============================================================

/**
 * 表单基础配置
 */
export interface FormFieldBase {
  /** 字段名 */
  field: string
  /** 标签 */
  label: string
  /** 是否必填 */
  required?: boolean
  /** 占位文本 */
  placeholder?: string
  /** 禁用状态 */
  disabled?: boolean
  /** 帮助文本 */
  tooltip?: string
}

/**
 * 文本输入字段
 */
export interface TextField extends FormFieldBase {
  type: 'text'
  /** 最大长度 */
  maxLength?: number
}

/**
 * 数字输入字段
 */
export interface NumberField extends FormFieldBase {
  type: 'number'
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步进值 */
  step?: number
  /** 前缀 */
  prefix?: string
  /** 后缀 */
  suffix?: string
}

/**
 * 选择字段
 */
export interface SelectField extends FormFieldBase {
  type: 'select'
  /** 选项列表 */
  options: Array<{ label: string; value: string | number }>
  /** 是否支持搜索 */
  searchable?: boolean
  /** 是否多选 */
  multiple?: boolean
  /** 占位文本 */
  placeholder?: string
}

/**
 * 日期选择字段
 */
export interface DateField extends FormFieldBase {
  type: 'date'
  /** 日期格式 */
  format?: string
  /** 是否显示时间 */
  showTime?: boolean
  /** 可选范围 */
  disabledDate?: (current: Date) => boolean
}

/**
 * 日期范围字段
 */
export interface DateRangeField extends FormFieldBase {
  type: 'dateRange'
  /** 日期格式 */
  format?: string
  /** 是否显示时间 */
  showTime?: boolean
  /** 起始字段名 */
  startField?: string
  /** 结束字段名 */
  endField?: string
}

/**
 * 开关字段
 */
export interface SwitchField extends FormFieldBase {
  type: 'switch'
  /** 开启时的值 */
  checkedValue?: any
  /** 关闭时的值 */
  unCheckedValue?: any
}

/**
 * 文本域字段
 */
export interface TextareaField extends FormFieldBase {
  type: 'textarea'
  /** 最大长度 */
  maxLength?: number
  /** 行数 */
  rows?: number
  /** 自动高度 */
  autoSize?: boolean
}

/**
 * 字段联合类型
 */
export type FormField =
  | TextField
  | NumberField
  | SelectField
  | DateField
  | DateRangeField
  | SwitchField
  | TextareaField

/**
 * 表单值类型
 */
export type FormValues = Record<string, any>

/**
 * 表单提交参数
 */
export interface FormSubmitParams<T = FormValues> {
  /** 表单值 */
  values: T
  /** 是否为编辑模式 */
  isEdit: boolean
  /** 编辑时的原始数据 */
  initialValues?: T
}

// ============================================================
// 页面组件 Props
// ============================================================

/**
 * 标准列表页 Props
 * @template T - 表格行数据类型
 */
export interface ListPageProps<T = any> {
  /** 页面标题 */
  title?: string
  /** 是否显示搜索区域 */
  showSearch?: boolean
  /** 搜索字段配置 */
  searchFields?: FormField[]
  /** 表格列配置 */
  columns: TableColumn<T>[]
  /** 操作列配置 */
  actions?: TableAction<T>[]
  /** 是否显示创建按钮 */
  showCreateButton?: boolean
  /** 创建按钮文本 */
  createButtonText?: string
  /** 是否支持批量删除 */
  showBatchDelete?: boolean
  /** 是否支持导出 */
  showExport?: boolean
  /** 额外操作按钮 */
  extraActions?: React.ReactNode
  /** 初始查询参数 */
  initialParams?: ListQueryParams
}

/**
 * 标准详情页 Props
 */
export interface DetailPageProps {
  /** 页面标题 */
  title?: string
  /** 资源 ID */
  id: Id
  /** 额外标签页 */
  tabs?: Array<{
    key: string
    label: string
    content: React.ReactNode
  }>
}

/**
 * 标准编辑页 Props
 */
export interface EditPageProps {
  /** 页面标题 */
  title?: string
  /** 资源 ID（编辑模式） */
  id?: Id
  /** 表单字段配置 */
  fields: FormField[]
  /** 提交成功回调 */
  onSuccess?: () => void
  /** 取消回调 */
  onCancel?: () => void
}

// ============================================================
// 状态相关
// ============================================================

/**
 * 状态选项配置
 */
export interface StatusOption {
  /** 状态值 */
  value: string
  /** 显示文本 */
  label: string
  /** 颜色 */
  color: string
}

/**
 * 状态映射类型
 */
export type StatusMap = Record<string, StatusOption>

/**
 * 状态列渲染 Props
 */
export interface StatusColumnProps {
  /** 状态值 */
  value: string
  /** 状态映射表 */
  statusMap: StatusMap
  /** 默认颜色 */
  defaultColor?: string
}

// ============================================================
// 通用操作
// ============================================================

/**
 * 删除确认参数
 */
export interface DeleteConfirmParams {
  /** 要删除的记录 */
  record: any
  /** 删除成功消息 */
  successMessage?: string
}

/**
 * 状态变更参数
 */
export interface StatusChangeParams {
  /** 记录 ID */
  id: Id
  /** 目标状态 */
  status: string
  /** 成功消息 */
  successMessage?: string
}

/**
 * 批量操作参数
 */
export interface BatchOperationParams {
  /** 选中的 ID 列表 */
  ids: Id[]
  /** 操作类型 */
  operation: 'delete' | 'status' | 'export'
  /** 目标状态（状态操作时） */
  status?: string
}

// ============================================================
// 加载状态
// ============================================================

/**
 * 异步操作状态
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * 带状态的响应
 */
export interface AsyncState<T> {
  /** 当前状态 */
  status: AsyncStatus
  /** 数据 */
  data?: T
  /** 错误信息 */
  error?: string
}

// ============================================================
// 筛选器
// ============================================================

/**
 * 筛选器配置
 */
export interface FilterConfig {
  /** 筛选字段 */
  fields: FormField[]
  /** 搜索按钮文本 */
  searchText?: string
  /** 重置按钮文本 */
  resetText?: string
  /** 是否折叠 */
  collapsible?: boolean
  /** 默认折叠 */
  defaultCollapsed?: boolean
}

/**
 * 筛选器值类型
 */
export type FilterValues = Record<string, any>
