import { get, post, del, put } from './request'

export type ReportType = 'schedule' | 'attendance' | 'leave-overtime' | 'finance'

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ExportFormat = 'xlsx' | 'xls' | 'csv'

export interface ExportTask {
  id: number
  reportType: ReportType
  format: ExportFormat
  status: ExportStatus
  fileName: string
  fileSize: number
  totalRows: number
  errorMsg: string
  createdAt: string
  startedAt: string
  completedAt: string
}

export interface ExportTemplate {
  id: number
  name: string
  reportType: ReportType
  fields: string[]
  isDefault: boolean
}

export interface ExportTaskListParams {
  page?: number
  pageSize?: number
  status?: ExportStatus
  reportType?: ReportType
}

export interface ExportTaskListResponse {
  list: ExportTask[]
  total: number
  page: number
  pageSize: number
}

export interface CreateExportTaskParams {
  reportType: ReportType
  format: ExportFormat
  filters?: Record<string, any>
  templateId?: number
}

export function createExportTask(params: CreateExportTaskParams) {
  return post<ExportTask>('/export-tasks', params)
}

export function getExportTasks(params: ExportTaskListParams) {
  return get<ExportTaskListResponse>('/export-tasks', { params })
}

export function getExportTask(id: number) {
  return get<ExportTask>(`/export-tasks/${id}`)
}

export function downloadExportTask(id: number) {
  return get(`/export-tasks/${id}/download`, {
    responseType: 'blob',
  })
}

export function deleteExportTask(id: number) {
  return del(`/export-tasks/${id}`)
}

export function getExportTemplates(reportType: ReportType) {
  return get<ExportTemplate[]>('/export-templates', { params: { reportType } })
}

export function createExportTemplate(data: Omit<ExportTemplate, 'id'>) {
  return post<ExportTemplate>('/export-templates', data)
}

export function updateExportTemplate(id: number, data: Partial<Omit<ExportTemplate, 'id'>>) {
  return put<ExportTemplate>(`/export-templates/${id}`, data)
}

export function deleteExportTemplate(id: number) {
  return del(`/export-templates/${id}`)
}
