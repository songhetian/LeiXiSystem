import { get, post } from './request'

export interface ExportTask {
  id: number
  fileName: string
  type: string
  status: string
  operator: string
  createTime: string
  size: string
}

export function uploadImportFile(type: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return post(`/data/import?type=${encodeURIComponent(type)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
}

export function createExportTask(data: any) {
  return post<{ code: 0; data: ExportTask }>('/data/export', data)
}

export function downloadTemplate(type: string) {
  return get(`/data/templates/${encodeURIComponent(type)}`, {
    responseType: 'blob',
  })
}

export function downloadExportFile(id: number) {
  return get<{ code: 0; data: Blob }>(`/data/exports/${id}/download`, {
    responseType: 'blob',
  })
}
