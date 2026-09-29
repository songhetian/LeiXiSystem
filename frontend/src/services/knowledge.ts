import request from '@/lib/request';

export interface KnowledgeCategory {
  id: number;
  name: string;
  sort: number;
  articleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticle {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  summary?: string;
  content?: string;
  authorId?: number;
  authorName?: string;
  viewCount: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeAttachment {
  id: number;
  articleId: number;
  fileName: string;
  fileType: string;
  mimeType?: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface PreviewUrlResult {
  previewUrl: string;
  expiresAt: number;
  fileName: string;
}

export interface CategoryListParams {
  page?: number;
  pageSize?: number;
}

export interface ArticleListParams {
  page?: number;
  pageSize?: number;
  categoryId?: number;
  keyword?: string;
  status?: string;
  /** 管理端：包含未发布（草稿等）文章，后端仅对 knowledge:manage 用户生效 */
  includeUnpublished?: boolean;
}

export interface CreateCategoryParams {
  name: string;
  sort?: number;
}

export interface UpdateCategoryParams {
  name?: string;
  sort?: number;
}

export interface CreateArticleParams {
  title: string;
  categoryId: number;
  summary?: string;
  content?: string;
  status?: 'draft' | 'published';
}

export interface UpdateArticleParams {
  title?: string;
  categoryId?: number;
  summary?: string;
  content?: string;
  status?: 'draft' | 'published';
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/** 分类列表后端直接返回数组（非分页包裹），与文章列表结构不同 */
export interface CategoryListResult {
  code: number;
  message?: string;
  data?: KnowledgeCategory[];
}

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export const knowledgeApi = {
  getCategories(params: CategoryListParams = {}): Promise<CategoryListResult> {
    return request.get('/knowledge/categories', { params });
  },

  createCategory(params: CreateCategoryParams): Promise<DetailResult<KnowledgeCategory>> {
    return request.post('/knowledge/categories', params);
  },

  updateCategory(id: number, params: UpdateCategoryParams): Promise<DetailResult<KnowledgeCategory>> {
    return request.put(`/knowledge/categories/${id}`, params);
  },

  deleteCategory(id: number): Promise<DetailResult<any>> {
    return request.delete(`/knowledge/categories/${id}`);
  },

  /** 拖拽排序：按 ids 顺序（从 0 递增）批量更新分类 sortOrder */
  reorderCategories(ids: number[]): Promise<DetailResult<any>> {
    return request.put('/knowledge/categories/reorder', { ids });
  },

  getArticles(params: ArticleListParams = {}): Promise<ListResult<KnowledgeArticle>> {
    return request.get('/knowledge/articles', { params });
  },

  getArticleDetail(id: number): Promise<DetailResult<KnowledgeArticle>> {
    return request.get(`/knowledge/articles/${id}`);
  },

  createArticle(params: CreateArticleParams): Promise<DetailResult<{ id: number }>> {
    return request.post('/knowledge/articles', params);
  },

  updateArticle(id: number, params: UpdateArticleParams): Promise<DetailResult<KnowledgeArticle>> {
    return request.put(`/knowledge/articles/${id}`, params);
  },

  deleteArticle(id: number): Promise<DetailResult<any>> {
    return request.delete(`/knowledge/articles/${id}`);
  },

  getAttachments(articleId: number): Promise<DetailResult<KnowledgeAttachment[]>> {
    return request.get(`/knowledge/articles/${articleId}/attachments`);
  },

  addAttachment(
    articleId: number,
    params: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string },
  ): Promise<DetailResult<KnowledgeAttachment>> {
    return request.post(`/knowledge/articles/${articleId}/attachments`, params);
  },

  deleteAttachment(articleId: number, attId: number): Promise<DetailResult<any>> {
    return request.delete(`/knowledge/articles/${articleId}/attachments/${attId}`);
  },

  /** 上传附件（multipart），onProgress 回调用于进度条展示（percent/loaded/total） */
  uploadAttachment(
    articleId: number,
    file: File,
    onProgress?: (e: { percent?: number; loaded: number; total?: number }) => void,
  ): Promise<DetailResult<KnowledgeAttachment>> {
    const formData = new FormData();
    formData.append('file', file);
    return request.post(`/knowledge/articles/${articleId}/attachments/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },

  getPreviewUrl(attachmentId: number): Promise<DetailResult<PreviewUrlResult>> {
    return request.get('/knowledge/preview-url', {
      params: { attachmentId },
    });
  },
};
