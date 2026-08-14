import { knowledgeApi } from '@/services/knowledge';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockCategory = {
  id: 1,
  name: '公司制度',
  sort: 1,
  articleCount: 10,
  createdAt: '2026-08-01T10:00:00+08:00',
};

const mockArticle = {
  id: 1,
  title: '员工手册',
  categoryId: 1,
  categoryName: '公司制度',
  summary: '公司基本规章制度说明',
  content: '<p>员工手册内容...</p>',
  authorId: 1,
  authorName: '管理员',
  viewCount: 100,
  status: 'published',
  createdAt: '2026-08-01T10:00:00+08:00',
  updatedAt: '2026-08-10T15:00:00+08:00',
};

const mockAttachment = {
  id: 1,
  articleId: 1,
  fileName: '员工手册.pdf',
  fileType: 'pdf',
  fileSize: 1024000,
  fileUrl: '/uploads/employee-handbook.pdf',
  uploadedBy: '管理员',
  createdAt: '2026-08-01T10:00:00+08:00',
};

const mockArticleListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockArticle],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

const mockCategoryListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockCategory],
    total: 1,
    page: 1,
    pageSize: 100,
  },
};

describe('knowledgeApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('分类 - 正常用例', () => {
    it('getCategories sends GET request', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockCategoryListResponse);
      const result = await knowledgeApi.getCategories();
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/categories', {
        params: {},
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('createCategory sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 2, name: '培训资料' },
      });
      const result = await knowledgeApi.createCategory({
        name: '培训资料',
        sort: 2,
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/knowledge/categories', {
        name: '培训资料',
        sort: 2,
      });
      expect(result.code).toBe(0);
    });

    it('updateCategory sends PUT request', async () => {
      mockedRequest.put.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, name: '公司规章制度' },
      });
      const result = await knowledgeApi.updateCategory(1, { name: '公司规章制度' });
      expect(mockedRequest.put).toHaveBeenCalledWith('/knowledge/categories/1', {
        name: '公司规章制度',
      });
      expect(result.code).toBe(0);
    });

    it('deleteCategory sends DELETE request', async () => {
      mockedRequest.delete.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
      });
      const result = await knowledgeApi.deleteCategory(1);
      expect(mockedRequest.delete).toHaveBeenCalledWith('/knowledge/categories/1');
      expect(result.code).toBe(0);
    });
  });

  describe('文章 - 正常用例', () => {
    it('getArticles sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockArticleListResponse);
      const result = await knowledgeApi.getArticles({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/articles', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('getArticles sends categoryId filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockArticleListResponse);
      await knowledgeApi.getArticles({ page: 1, pageSize: 20, categoryId: 1 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/articles', {
        params: { page: 1, pageSize: 20, categoryId: 1 },
      });
    });

    it('getArticles sends keyword search', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockArticleListResponse);
      await knowledgeApi.getArticles({ page: 1, pageSize: 20, keyword: '手册' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/articles', {
        params: { page: 1, pageSize: 20, keyword: '手册' },
      });
    });

    it('getArticleDetail sends GET request', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: mockArticle,
      });
      const result = await knowledgeApi.getArticleDetail(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/articles/1');
      expect(result.code).toBe(0);
      expect(result.data!.id).toBe(1);
    });

    it('createArticle sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 2 },
      });
      const result = await knowledgeApi.createArticle({
        title: '新文章',
        categoryId: 1,
        content: '<p>内容</p>',
        status: 'published',
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/knowledge/articles', {
        title: '新文章',
        categoryId: 1,
        content: '<p>内容</p>',
        status: 'published',
      });
      expect(result.code).toBe(0);
    });

    it('updateArticle sends PUT request', async () => {
      mockedRequest.put.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, title: '更新的标题' },
      });
      const result = await knowledgeApi.updateArticle(1, { title: '更新的标题' });
      expect(mockedRequest.put).toHaveBeenCalledWith('/knowledge/articles/1', {
        title: '更新的标题',
      });
      expect(result.code).toBe(0);
    });

    it('deleteArticle sends DELETE request', async () => {
      mockedRequest.delete.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
      });
      const result = await knowledgeApi.deleteArticle(1);
      expect(mockedRequest.delete).toHaveBeenCalledWith('/knowledge/articles/1');
      expect(result.code).toBe(0);
    });
  });

  describe('附件 - 正常用例', () => {
    it('getAttachments sends GET request', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: [mockAttachment],
      });
      const result = await knowledgeApi.getAttachments(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/articles/1/attachments');
      expect(result.code).toBe(0);
    });
  });

  describe('预览 - 正常用例', () => {
    it('getPreviewUrl sends GET request with attachmentId', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: {
          previewUrl: 'https://kkfileview.example.com/onlinePreview?token=xxx',
          token: 'xxx',
          expiresAt: '2026-08-13T11:00:00+08:00',
        },
      });
      const result = await knowledgeApi.getPreviewUrl(42);
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/preview-url', {
        params: { attachmentId: 42 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.previewUrl).toBeTruthy();
    });
  });

  describe('边界用例', () => {
    it('handles empty article list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await knowledgeApi.getArticles({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
      expect(result.data!.total).toBe(0);
    });

    it('uses default params when not provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockArticleListResponse);
      await knowledgeApi.getArticles({});
      expect(mockedRequest.get).toHaveBeenCalledWith('/knowledge/articles', {
        params: {},
      });
    });

    it('handles empty category list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 100 },
      });
      const result = await knowledgeApi.getCategories();
      expect(result.data!.list).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles category not found error (code 5001)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5001,
        message: '分类不存在',
      });
      const result = await knowledgeApi.getArticleDetail(999);
      expect(result.code).toBe(5001);
    });

    it('handles article not found error (code 5002)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5002,
        message: '文章不存在',
      });
      const result = await knowledgeApi.getArticleDetail(999);
      expect(result.code).toBe(5002);
      expect(result.message).toBe('文章不存在');
    });

    it('handles attachment not found error (code 5003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5003,
        message: '附件不存在',
      });
      const result = await knowledgeApi.getAttachments(999);
      expect(result.code).toBe(5003);
    });

    it('handles preview token empty error (code 5004)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5004,
        message: '预览 token 不能为空',
      });
      const result = await knowledgeApi.getPreviewUrl(0);
      expect(result.code).toBe(5004);
    });

    it('handles permission error (code 5003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5003,
        message: '无权限访问该数据',
      });
      const result = await knowledgeApi.getArticles({ page: 1, pageSize: 20 });
      expect(result.code).toBe(5003);
    });
  });
});
