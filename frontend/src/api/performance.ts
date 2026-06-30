import { get, post, put, del } from './request'

// Cycles
export function getPerformanceCycles(params?: any) {
  return get('/performance/cycles', { params })
}

export function getPerformanceCycleDetail(id: number) {
  return get(`/performance/cycles/${id}`)
}

export function createPerformanceCycle(data: any) {
  return post('/performance/cycles', data)
}

export function updatePerformanceCycle(id: number, data: any) {
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
export function getPerformanceGoals(params?: any) {
  return get('/performance/goals', { params })
}

export function getPerformanceGoalDetail(id: number) {
  return get(`/performance/goals/${id}`)
}

export function createPerformanceGoal(data: any) {
  return post('/performance/goals', data)
}

export function updatePerformanceGoal(id: number, data: any) {
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
  cycle?: any
  employee?: any
  reviewer?: any
}

export function getPerformanceReviews(params?: any) {
  return get<{ code: 0; data: { list: Review[]; total: number; page: number; pageSize: number } }>('/performance/reviews', { params })
}

export function getPerformanceReviewDetail(id: number) {
  return get(`/performance/reviews/${id}`)
}

export function createPerformanceReview(data: any) {
  return post('/performance/reviews', data)
}

export function updatePerformanceReview(id: number, data: any) {
  return put(`/performance/reviews/${id}`, data)
}
