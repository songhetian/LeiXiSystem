import { get, post, put, del } from './request'

export interface OnboardingFlow {
  id: number
  name: string
  description?: string
  departmentId?: number
  positionId?: number
  status: string
  isDefault: boolean
  sortOrder: number
  steps?: OnboardingFlowStep[]
  nodes?: Record<string, unknown>[]
  edges?: Record<string, unknown>[]
  department?: { id: number; name: string }
  position?: { id: number; name: string }
  createdBy?: number
  createdAt: string
  updatedAt: string
}

// 步骤类型
export interface OnboardingStepType {
  id: number
  name: string
  code: string
  icon?: string
  color?: string
  description?: string
  status: string
  sortOrder: number
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface OnboardingFlowStep {
  id: number
  flowId: number
  title: string
  description?: string
  stepOrder: number
  type: 'document' | 'task' | 'meeting' | 'training' | 'system'
  assigneeRole?: string
  departmentId?: number
  dueDays: number
  required: boolean
  createdAt: string
  updatedAt: string
}

export interface OnboardingTaskItem {
  id: number
  title: string
  type: string
  status: string
  dueDate?: string
  completedAt?: string
  assigneeRole?: string
}

export interface OnboardingProgress {
  id: number
  employeeId: number
  flowId?: number
  status: string
  startDate: string
  completedDate?: string
  currentStep: number
  totalSteps: number
  totalTasks: number
  completedTasks: number
  progress: number
  tasks: OnboardingTaskItem[]
}

// 获取入职流程模板列表
export function getOnboardingFlows(params?: {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  departmentId?: number
}) {
  return get<{
    code: 0
    data: {
      list: OnboardingFlow[]
      total: number
      page: number
      pageSize: number
    }
  }>('/lifecycle/flows', { params })
}

// 获取流程模板详情
export function getOnboardingFlow(id: number) {
  return get<{
    code: 0
    data: OnboardingFlow
  }>(`/lifecycle/flows/${id}`)
}

// 创建流程模板
export function createOnboardingFlow(data: {
  name: string
  description?: string
  departmentId?: number
  positionId?: number
  status?: string
  isDefault?: boolean
  sortOrder?: number
  nodes?: Record<string, unknown>[]
  edges?: Record<string, unknown>[]
  steps?: Array<{
    title: string
    description?: string
    stepOrder: number
    type: string
    assigneeRole?: string
    departmentId?: number
    dueDays: number
    required?: boolean
  }>
}) {
  return post<{
    code: 0
    data: OnboardingFlow
  }>('/lifecycle/flows', data)
}

// 更新流程模板
export function updateOnboardingFlow(
  id: number,
  data: {
    name?: string
    description?: string
    departmentId?: number
    positionId?: number
    status?: string
    isDefault?: boolean
    sortOrder?: number
    nodes?: Record<string, unknown>[]
    edges?: Record<string, unknown>[]
  },
) {
  return put<{
    code: 0
    data: OnboardingFlow
  }>(`/lifecycle/flows/${id}`, data)
}

// 删除流程模板
export function deleteOnboardingFlow(id: number) {
  return del(`/lifecycle/flows/${id}`)
}

// 添加流程步骤
export function addFlowStep(
  flowId: number,
  data: {
    title: string
    description?: string
    stepOrder: number
    type: string
    assigneeRole?: string
    departmentId?: number
    dueDays?: number
    required?: boolean
  },
) {
  return post(`/lifecycle/flows/${flowId}/steps`, data)
}

// 更新流程步骤
export function updateFlowStep(
  stepId: number,
  data: {
    title?: string
    description?: string
    stepOrder?: number
    type?: string
    assigneeRole?: string
    departmentId?: number
    dueDays?: number
    required?: boolean
  },
) {
  return put(`/lifecycle/steps/${stepId}`, data)
}

// 删除流程步骤
export function deleteFlowStep(stepId: number) {
  return del(`/lifecycle/steps/${stepId}`)
}

// 启动入职流程
export function startOnboarding(data: { employeeId: number; flowId?: number; startDate?: string }) {
  return post('/lifecycle/start', data)
}

// 获取员工入职进度
export function getOnboardingProgress(employeeId: number) {
  return get<{
    code: 0
    data: OnboardingProgress | null
  }>(`/lifecycle/progress/${employeeId}`)
}

// 完成入职流程
export function completeOnboarding(employeeId: number) {
  return post(`/lifecycle/complete/${employeeId}`)
}

export const STEP_TYPES = [
  { value: 'document', label: '文档提交' },
  { value: 'task', label: '待办任务' },
  { value: 'meeting', label: '入职会议' },
  { value: 'training', label: '入职培训' },
  { value: 'system', label: '系统账号' },
]

// 获取步骤类型列表
export function getStepTypes() {
  return get<{ code: 0; data: OnboardingStepType[] }>('/lifecycle/step-types')
}

// 创建步骤类型
export function createStepType(data: {
  name: string
  code?: string
  icon?: string
  color?: string
  description?: string
  sortOrder?: number
}) {
  return post<{ code: 0; data: OnboardingStepType }>('/lifecycle/step-types', data)
}

// 更新步骤类型
export function updateStepType(
  id: number,
  data: Partial<{
    name: string
    icon: string
    color: string
    description: string
    status: string
    sortOrder: number
  }>,
) {
  return put<{ code: 0; data: OnboardingStepType }>(`/lifecycle/step-types/${id}`, data)
}

// 删除步骤类型
export function deleteStepType(id: number) {
  return del(`/lifecycle/step-types/${id}`)
}
