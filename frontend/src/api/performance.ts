import { get, post, put } from './request'

export function getPerformanceCycles(params?: any) {
  return get('/performance/cycles', { params })
}

export function createPerformanceCycle(data: any) {
  return post('/performance/cycles', data)
}

export function getPerformanceGoals(params?: any) {
  return get('/performance/goals', { params })
}

export function createPerformanceGoal(data: any) {
  return post('/performance/goals', data)
}

export function getPerformanceReviews(params?: any) {
  return get('/performance/reviews', { params })
}

export function createPerformanceReview(data: any) {
  return post('/performance/reviews', data)
}

export function updatePerformanceReview(id: number, data: any) {
  return put(`/performance/reviews/${id}`, data)
}
