import { get, post, put, del } from './request'

export interface KbCategory {
  id: number
  name: string
  parentId?: number
  sortOrder: number
  categoryType: string
  visibility: string
  visibilityConfig?: any
  articleCount: number
  children: KbCategory[]
}

export interface KbArticle {
  id: number
  title: string
  content: string
  categoryId?: number
  tags?: string
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  status: string
  authorId: number
  createdAt: string
  updatedAt: string
  category?: { id: number; name: string; categoryType: string }
}

// Categories
export function getKbCategories(categoryType?: string) {
  return get<{ code: number; data: KbCategory[] }>('/kb/categories', { categoryType })
}

export function createKbCategory(data: any) {
  return post<{ code: number; data: KbCategory }>('/kb/categories', data)
}

export function updateKbCategory(id: number, data: any) {
  return put<{ code: number; data: KbCategory }>(`/kb/categories/${id}`, data)
}

export function deleteKbCategory(id: number) {
  return del<{ code: number }>(`/kb/categories/${id}`)
}

// Articles
export function getKbArticles(params?: any) {
  return get<{ code: number; data: { total: number; list: KbArticle[] } }>('/kb/articles', params)
}

export function createKbArticle(data: any) {
  return post<{ code: number; data: KbArticle }>('/kb/articles', data)
}

export function getKbArticle(id: number) {
  return get<{ code: number; data: KbArticle }>(`/kb/articles/${id}`)
}

export function updateKbArticle(id: number, data: any) {
  return put<{ code: number; data: KbArticle }>(`/kb/articles/${id}`, data)
}

export function deleteKbArticle(id: number) {
  return del<{ code: number }>(`/kb/articles/${id}`)
}

// Search
export function searchKb(params: { q: string; page?: number; categoryId?: number; categoryType?: string }) {
  return get<{ code: number; data: { total: number; list: KbArticle[]; keyword: string } }>('/kb/search', params)
}

// Feedback
export function submitKbFeedback(articleId: number, helpful: boolean) {
  return post<{ code: number }>(`/kb/articles/${articleId}/feedback`, { helpful })
}

// Reference
export function recordKbReference(articleId: number, ticketId: number) {
  return post<{ code: number }>(`/kb/articles/${articleId}/reference`, { ticketId })
}

export function getKbReferences(articleId: number) {
  return get<{ code: number; data: any[] }>(`/kb/articles/${articleId}/references`)
}
