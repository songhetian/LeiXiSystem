import { get, post, put, del } from './request'

// ===== Local request type interfaces =====

export interface PerformanceCycleQueryParams {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  keyword?: string
}

export interface CreatePerformanceCycleParams {
  name: string
  type: string
  startDate: string
  endDate: string
  selfReviewDeadline?: string
  managerReviewDeadline?: string
  calibrationDeadline?: string
}

export type UpdatePerformanceCycleParams = Partial<CreatePerformanceCycleParams> & {
  status?: string
}

export interface PerformanceGoalQueryParams {
  page?: number
  pageSize?: number
  cycleId?: number
  employeeId?: number
  status?: string
}

export interface CreatePerformanceGoalParams {
  cycleId: number
  employeeId: number
  title: string
  description?: string
  weight: number
  targetValue?: string
  dueDate?: string
}

export type UpdatePerformanceGoalParams = Partial<CreatePerformanceGoalParams> & {
  status?: string
  actualValue?: string
  progress?: number
}

export interface PerformanceReviewQueryParams {
  page?: number
  pageSize?: number
  cycleId?: number
  employeeId?: number
  status?: string
}

export interface CreatePerformanceReviewParams {
  cycleId: number
  employeeId: number
  managerId: number
}

export interface UpdatePerformanceReviewParams {
  selfRating?: number
  managerRating?: number
  finalRating?: number
  selfComment?: string
  managerComment?: string
  developmentPlan?: string
  promotionRecommendation?: boolean
}

// Cycles
export function getPerformanceCycles(params?: PerformanceCycleQueryParams) {
  return get('/performance/cycles', { params })
}

export function getPerformanceCycleDetail(id: number) {
  return get(`/performance/cycles/${id}`)
}

export function createPerformanceCycle(data: CreatePerformanceCycleParams) {
  return post('/performance/cycles', data)
}

export function updatePerformanceCycle(id: number, data: UpdatePerformanceCycleParams) {
  return put(`/performance/cycles/${id}`, data)
}

export function deletePerformanceCycle(id: number) {
  return del(`/performance/cycles/${id}`)
}

export function activatePerformanceCycle(id: number) {
  return post(`/performance/cycles/${id}/activate`)
}

export function closePerformanceCycle(id: number) {
  return post(`/performance/cycles/${id}/close`)
}

// Goals
export function getPerformanceGoals(params?: PerformanceGoalQueryParams) {
  return get('/performance/goals', { params })
}

export function getPerformanceGoalDetail(id: number) {
  return get(`/performance/goals/${id}`)
}

export function createPerformanceGoal(data: CreatePerformanceGoalParams) {
  return post('/performance/goals', data)
}

export function updatePerformanceGoal(id: number, data: UpdatePerformanceGoalParams) {
  return put(`/performance/goals/${id}`, data)
}

export function deletePerformanceGoal(id: number) {
  return del(`/performance/goals/${id}`)
}

// Reviews
export interface Review {
  id: number
  selfScore?: number
  managerScore?: number
  finalScore?: number
  rating?: string
  status: string
  selfComment?: string
  managerComment?: string
  cycle?: { id: number; name: string; type: string }
  employee?: { id: number; name: string; employeeNo: string }
  reviewer?: { id: number; name: string }
}

export function getPerformanceReviews(params?: PerformanceReviewQueryParams) {
  return get<{ code: 0; data: { list: Review[]; total: number; page: number; pageSize: number } }>('/performance/reviews', { params })
}

export function getPerformanceReviewDetail(id: number) {
  return get(`/performance/reviews/${id}`)
}

export function createPerformanceReview(data: CreatePerformanceReviewParams) {
  return post('/performance/reviews', data)
}

export function updatePerformanceReview(id: number, data: UpdatePerformanceReviewParams) {
  return put(`/performance/reviews/${id}`, data)
}
