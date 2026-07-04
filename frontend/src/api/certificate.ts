import { get, post, put, del } from './request'

export interface Certificate {
  id: number
  employeeId: number
  employeeName: string
  employeeNo: string
  departmentName?: string
  type: string
  typeName: string
  purpose?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'generated'
  content?: string
  templateId?: number
  templateName?: string
  generatedAt?: string
  fileUrl?: string
  createdAt: string
  updatedAt: string
  approverName?: string
  approvedAt?: string
  rejectReason?: string
}

export interface CertificateListResponse {
  code: 0
  data: {
    list: Certificate[]
    total: number
    page: number
    pageSize: number
  }
}

export interface CertificateResponse {
  code: 0
  data: Certificate
}

export function getMyCertificates(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  startDate?: string
  endDate?: string
}) {
  return get<CertificateListResponse>('/employee/certificates/my', { params })
}

export function createCertificate(data: {
  type: string
  purpose?: string
  templateId?: number
}) {
  return post<CertificateResponse>('/employee/certificates', data)
}

export function getCertificate(id: number) {
  return get<CertificateResponse>(`/employee/certificates/${id}`)
}

export function cancelCertificate(id: number) {
  return del(`/employee/certificates/${id}`)
}

export function getCertificateList(params?: {
  page?: number
  pageSize?: number
  keyword?: string
  departmentId?: number
  type?: string
  status?: string
  startDate?: string
  endDate?: string
}) {
  return get<CertificateListResponse>('/employee/certificates', { params })
}

export function approveCertificate(id: number) {
  return put<CertificateResponse>(`/employee/certificates/${id}/approve`)
}

export function rejectCertificate(id: number, data: { reason: string }) {
  return put<CertificateResponse>(`/employee/certificates/${id}/reject`, data)
}

export function generateCertificate(id: number, data?: {
  templateId?: number
  content?: string
}) {
  return put<CertificateResponse>(`/employee/certificates/${id}/generate`, data)
}
