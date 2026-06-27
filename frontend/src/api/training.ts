import { get, post } from './request'

export function getTrainingCourses(params?: any) {
  return get('/training/courses', { params })
}

export function createTrainingCourse(data: any) {
  return post('/training/courses', data)
}

export function getTrainingSessions(params?: any) {
  return get('/training/sessions', { params })
}

export function createTrainingSession(data: any) {
  return post('/training/sessions', data)
}

export function getTrainingEnrollments(params?: any) {
  return get('/training/enrollments', { params })
}

export function createTrainingEnrollment(data: any) {
  return post('/training/enrollments', data)
}

export function completeTrainingEnrollment(id: number, data?: any) {
  return post(`/training/enrollments/${id}/complete`, data)
}
