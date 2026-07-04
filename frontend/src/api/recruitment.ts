import { get, post, put, del } from './request'

// ===== Local request type interfaces =====

export interface RecruitmentRequestQueryParams {
  page?: number
  pageSize?: number
  status?: string
  departmentId?: number
  keyword?: string
}

export interface CreateRecruitmentRequestParams {
  title: string
  departmentId: number
  positionId?: number
  headcount: number
  reason?: string
  priority?: string
}

export type UpdateRecruitmentRequestParams = Partial<CreateRecruitmentRequestParams> & {
  status?: string
}

export interface CreateJobOpeningParams {
  title: string
  departmentId: number
  positionId?: number
  headcount: number
  description?: string
  requirements?: string
  source?: string
}

export type UpdateJobOpeningParams = Partial<CreateJobOpeningParams> & {
  status?: string
}

export interface CreateCandidateParams {
  name: string
  phone?: string
  email?: string
  jobOpeningId?: number
  source?: string
  resumeUrl?: string
  note?: string
}

export type UpdateCandidateParams = Partial<CreateCandidateParams> & {
  status?: string
  rating?: number
}

export interface CreateInterviewParams {
  candidateId: number
  jobOpeningId: number
  round: number
  roundName?: string
  interviewerId?: number
  scheduledAt?: string
  status?: string
}

export interface OfferQueryParams {
  page?: number
  pageSize?: number
  status?: string
  candidateId?: number
  jobOpeningId?: number
}

export interface CreateOfferParams {
  candidateId: number
  jobOpeningId?: number
  salary?: number
  startDate?: string
}

export type UpdateOfferParams = Partial<CreateOfferParams> & {
  status?: string
}

// ===== Recruitment Requests =====

export interface RecruitmentRequest {
  id: number
  title: string
  departmentId: number
  positionId?: number
  headcount: number
  reason?: string
  priority: string
  status: string
  department?: { name: string }
  position?: { name: string }
  creator?: { realName: string }
  createdAt?: string
}

export function getRecruitmentRequests(params?: RecruitmentRequestQueryParams) {
  return get<{ code: 0; data: { list: RecruitmentRequest[]; total: number; page: number; pageSize: number } }>('/recruitment/requests', { params })
}

export function getRecruitmentRequestDetail(id: number) {
  return get<{ code: 0; data: RecruitmentRequest }>(`/recruitment/requests/${id}`)
}

export function createRecruitmentRequest(data: CreateRecruitmentRequestParams) {
  return post('/recruitment/requests', data)
}

export function updateRecruitmentRequest(id: number, data: UpdateRecruitmentRequestParams) {
  return put(`/recruitment/requests/${id}`, data)
}

export function deleteRecruitmentRequest(id: number) {
  return del(`/recruitment/requests/${id}`)
}

export function openRecruitmentRequest(id: number) {
  return post(`/recruitment/requests/${id}/open`)
}

export function closeRecruitmentRequest(id: number) {
  return post(`/recruitment/requests/${id}/close`)
}

// ===== Job Openings =====

export interface JobOpening {
  id: number
  title: string
  departmentId: number
  positionId?: number
  headcount: number
  status: string
  department?: { name: string }
  position?: { name: string }
  createdAt?: string
}

export function getJobOpenings(params?: {
  page?: number
  pageSize?: number
  status?: string
  departmentId?: number
}) {
  return get<{ code: 0; data: { list: JobOpening[]; total: number; page: number; pageSize: number } }>('/recruitment/openings', { params })
}

export function getJobOpeningDetail(id: number) {
  return get<{ code: 0; data: JobOpening }>(`/recruitment/openings/${id}`)
}

export function createJobOpening(data: CreateJobOpeningParams) {
  return post('/recruitment/openings', data)
}

export function updateJobOpening(id: number, data: UpdateJobOpeningParams) {
  return put(`/recruitment/openings/${id}`, data)
}

export function deleteJobOpening(id: number) {
  return del(`/recruitment/openings/${id}`)
}

export function openJobOpening(id: number) {
  return post(`/recruitment/openings/${id}/open`)
}

export function closeJobOpening(id: number) {
  return post(`/recruitment/openings/${id}/close`)
}

// ===== Candidates =====

export interface Candidate {
  id: number
  name: string
  phone?: string
  email?: string
  jobOpeningId?: number
  status: string
  source?: string
  rating?: number
  resumeUrl?: string
  note?: string
  jobOpening?: { title: string }
  _count?: { interviews: number; offers: number }
}

export function getCandidates(params?: {
  page?: number
  pageSize?: number
  status?: string
  jobOpeningId?: number | string
}) {
  return get<{ code: 0; data: { list: Candidate[]; total: number; page: number; pageSize: number } }>('/recruitment/candidates', { params })
}

export function getCandidateDetail(id: number) {
  return get<{ code: 0; data: Candidate }>(`/recruitment/candidates/${id}`)
}

export function createCandidate(data: CreateCandidateParams) {
  return post('/recruitment/candidates', data)
}

export function updateCandidate(id: number, data: UpdateCandidateParams) {
  return put(`/recruitment/candidates/${id}`, data)
}

export function deleteCandidate(id: number) {
  return del(`/recruitment/candidates/${id}`)
}

// ===== Interviews =====

export interface InterviewRecord {
  id: number
  candidateId: number
  jobOpeningId: number
  round: number
  roundName?: string
  interviewer?: { realName: string }
  status: string
  scheduledAt?: string
  interviewAt?: string
  result?: string
  feedback?: string
  candidate?: { id: number; name: string; phone?: string; jobOpening?: { title: string } }
  interviewerInfo?: { realName: string }
  jobOpening?: { title: string }
  createdAt?: string
}

export function getInterviews(params?: {
  page?: number
  pageSize?: number
  status?: string
  jobOpeningId?: number | string
}) {
  return get<{ code: 0; data: { list: InterviewRecord[]; total: number; page: number; pageSize: number } }>('/recruitment/interviews', { params })
}

export function createInterview(data: CreateInterviewParams) {
  return post('/recruitment/interviews', data)
}

// ===== Offers =====

export interface OfferRecord {
  id: number
  offerNo: string
  salary?: number
  startDate?: string
  status: string
  acceptedAt?: string
  candidate?: { id: number; name: string; phone?: string; jobOpening?: { title: string } }
  createdAt?: string
}

export function getOffers(params?: OfferQueryParams) {
  return get<{ code: 0; data: { list: OfferRecord[]; total: number; page: number; pageSize: number } }>('/recruitment/offers', { params })
}

export function getOfferDetail(id: number) {
  return get<{ code: 0; data: OfferRecord }>(`/recruitment/offers/${id}`)
}

export function createOffer(data: CreateOfferParams) {
  return post('/recruitment/offers', data)
}

export function updateOffer(id: number, data: UpdateOfferParams) {
  return put(`/recruitment/offers/${id}`, data)
}

export function acceptOffer(id: number, data?: { acceptedAt?: string; note?: string }) {
  return post(`/recruitment/offers/${id}/accept`, data)
}
