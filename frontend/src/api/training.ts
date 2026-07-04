import { get, post } from './request'

// ===== Local request type interfaces =====

export interface TrainingCourseQueryParams {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
  category?: string
}

export interface CreateTrainingCourseParams {
  title: string
  description?: string
  category?: string
  duration?: number
  instructor?: string
  maxParticipants?: number
  status?: string
}

export interface TrainingSessionQueryParams {
  page?: number
  pageSize?: number
  courseId?: number
  status?: string
  startDate?: string
  endDate?: string
}

export interface CreateTrainingSessionParams {
  courseId: number
  title?: string
  startDate: string
  endDate?: string
  location?: string
  instructorId?: number
  maxParticipants?: number
}

export interface TrainingEnrollmentQueryParams {
  page?: number
  pageSize?: number
  sessionId?: number
  employeeId?: number
  status?: string
}

export interface CreateTrainingEnrollmentParams {
  sessionId: number
  employeeId: number
}

export interface CompleteTrainingEnrollmentParams {
  score?: number
  feedback?: string
  certificateUrl?: string
}

export function getTrainingCourses(params?: TrainingCourseQueryParams) {
  return get('/training/courses', { params })
}

export function createTrainingCourse(data: CreateTrainingCourseParams) {
  return post('/training/courses', data)
}

export function getTrainingSessions(params?: TrainingSessionQueryParams) {
  return get('/training/sessions', { params })
}

export function createTrainingSession(data: CreateTrainingSessionParams) {
  return post('/training/sessions', data)
}

export function getTrainingEnrollments(params?: TrainingEnrollmentQueryParams) {
  return get('/training/enrollments', { params })
}

export function createTrainingEnrollment(data: CreateTrainingEnrollmentParams) {
  return post('/training/enrollments', data)
}

export function completeTrainingEnrollment(id: number, data?: CompleteTrainingEnrollmentParams) {
  return post(`/training/enrollments/${id}/complete`, data)
}
