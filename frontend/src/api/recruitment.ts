import { get, post } from './request'

export function getRecruitmentRequests(params?: any) {
  return get('/recruitment/requests', { params })
}

export function createRecruitmentRequest(data: any) {
  return post('/recruitment/requests', data)
}

export function getJobOpenings(params?: any) {
  return get('/recruitment/openings', { params })
}

export function createJobOpening(data: any) {
  return post('/recruitment/openings', data)
}

export function getCandidates(params?: any) {
  return get('/recruitment/candidates', { params })
}

export function createCandidate(data: any) {
  return post('/recruitment/candidates', data)
}

export function createInterview(data: any) {
  return post('/recruitment/interviews', data)
}

export function createOffer(data: any) {
  return post('/recruitment/offers', data)
}

export function acceptOffer(id: number, data?: any) {
  return post(`/recruitment/offers/${id}/accept`, data)
}
