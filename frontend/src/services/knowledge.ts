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
  fileSize: number;
  fileUrl: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface PreviewUrlResult {
  previewUrl: string;
  token: string;
  expiresAt: string;
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

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export const knowledgeApi = {
  getCategories(params: CategoryListParams = {}): Promise<ListResult<KnowledgeCategory>> {
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

  getPreviewUrl(fileUrl: string): Promise<DetailResult<PreviewUrlResult>> {
    return request.get('/knowledge/preview-url', {
      params: { fileUrl },
    });
  },
};
