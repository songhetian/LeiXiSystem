import { get, post, put } from './request'

export function getLifecycleEvents(params?: any) {
  return get('/lifecycle/events', { params })
}

export function createLifecycleEvent(data: any) {
  return post('/lifecycle/events', data)
}

export function completeLifecycleEvent(id: number) {
  return post(`/lifecycle/events/${id}/complete`)
}

export function getOnboardingTasks(params?: any) {
  return get('/lifecycle/onboarding-tasks', { params })
}

export function createOnboardingTask(data: any) {
  return post('/lifecycle/onboarding-tasks', data)
}

export function updateOnboardingTask(id: number, data: any) {
  return put(`/lifecycle/onboarding-tasks/${id}`, data)
}

export function getOffboardingTasks(params?: any) {
  return get('/lifecycle/offboarding-tasks', { params })
}

export function createOffboardingTask(data: any) {
  return post('/lifecycle/offboarding-tasks', data)
}

export function updateOffboardingTask(id: number, data: any) {
  return put(`/lifecycle/offboarding-tasks/${id}`, data)
}

export function getEmployeeDocuments(params?: any) {
  return get('/lifecycle/documents', { params })
}

export function createEmployeeDocument(data: any) {
  return post('/lifecycle/documents', data)
}

export function getEmployeeContracts(params?: any) {
  return get('/lifecycle/contracts', { params })
}

export function createEmployeeContract(data: any) {
  return post('/lifecycle/contracts', data)
}
