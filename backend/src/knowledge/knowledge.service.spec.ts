import { KnowledgeService } from './knowledge.service';
import { verifyPreviewToken, signPreviewUrl } from './engine/preview-sign';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mock PrismaService
function createMockPrisma() {
  const knowledgeAttachment = {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  return {
    knowledgeAttachment,
    knowledgeArticle: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
    knowledgeCategory: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    knowledgeArticleDailyStat: { findMany: jest.fn(), aggregate: jest.fn() },
    $executeRaw: jest.fn(),
  } as any;
}

// Mock JwtService
function createMockJwt() {
  return {
    verifyAsync: jest.fn(),
  } as any;
}

const TEST_SECRET = 'test-preview-secret-for-knowledge';

describe('KnowledgeService - getPreviewUrl (Open-File-Viewer 迁移)', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;

  beforeEach(() => {
    process.env.PREVIEW_SECRET = TEST_SECRET;
    prisma = createMockPrisma();
    jwt = createMockJwt();
    service = new KnowledgeService(prisma, jwt);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockAttachment = {
    id: 42,
    articleId: 1,
    fileName: '员工手册.pdf',
    fileUrl: '/uploads/knowledge/handbook.pdf',
    fileSize: 102400,
    mimeType: 'application/pdf',
    createdAt: new Date(),
  };

  // ------------------------------------------------------------------
  // 正常用例：返回前端路由 URL
  // ------------------------------------------------------------------
  it('返回的 previewUrl 以 /knowledge/preview/ 开头', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    expect(result.previewUrl).toMatch(/^\/knowledge\/preview\//);
  });

  it('返回的 previewUrl 包含正确的 attachmentId', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    expect(result.previewUrl).toContain('/knowledge/preview/42');
  });

  it('返回的 previewUrl 包含 token 参数', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    expect(result.previewUrl).toMatch(/[?&]token=.+/);
  });

  it('返回的 previewUrl 不再包含 onlinePreview（KKFileView 遗留）', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    expect(result.previewUrl).not.toContain('onlinePreview');
  });

  it('返回的 fileName 与附件一致', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    expect(result.fileName).toBe('员工手册.pdf');
  });

  it('返回的 expiresAt 为未来时间', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  // ------------------------------------------------------------------
  // token 签名验证：token 仍使用 PREVIEW_SECRET 签名
  // ------------------------------------------------------------------
  it('URL 中的 token 可通过 verifyPreviewToken 用同一 secret 验证', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    // 从 URL 中提取 token
    const tokenMatch = result.previewUrl.match(/[?&]token=(.+)/);
    expect(tokenMatch).not.toBeNull();
    const token = tokenMatch![1];

    const verifyResult = verifyPreviewToken(token, TEST_SECRET);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.payload!.fileUrl).toBe('/uploads/knowledge/handbook.pdf');
    expect(verifyResult.payload!.fileName).toBe('员工手册.pdf');
  });

  it('token 用错误的 secret 验证应失败', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);

    const result = await service.getPreviewUrl(42);

    const tokenMatch = result.previewUrl.match(/[?&]token=(.+)/);
    const token = tokenMatch![1];

    const verifyResult = verifyPreviewToken(token, 'wrong-secret');
    expect(verifyResult.valid).toBe(false);
  });

  // ------------------------------------------------------------------
  // 边界用例
  // ------------------------------------------------------------------
  it('附件不存在时抛出 NotFoundException', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(null);

    await expect(service.getPreviewUrl(999)).rejects.toThrow();
  });

  it('PREVIEW_SECRET 未配置时抛出 BadRequestException', async () => {
    delete process.env.PREVIEW_SECRET;
    const serviceNoSecret = new KnowledgeService(prisma, jwt);

    await expect(serviceNoSecret.getPreviewUrl(42)).rejects.toThrow();
  });
});

describe('KnowledgeService - addAttachment 安全校验', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;

  const mockArticle = { id: 1, title: '测试文章', categoryId: 1 };

  beforeEach(() => {
    prisma = createMockPrisma();
    jwt = createMockJwt();
    service = new KnowledgeService(prisma, jwt);
    prisma.knowledgeArticle.findUnique.mockResolvedValue(mockArticle);
    prisma.knowledgeAttachment.create.mockImplementation((data: any) =>
      Promise.resolve({ id: 1, ...data.data })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('合法文件上传成功', () => {
    it('PDF 文件上传成功', async () => {
      const result = await service.addAttachment({
        articleId: 1,
        fileName: 'report.pdf',
        fileUrl: '/uploads/knowledge/report.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
      });
      expect(result.fileName).toBe('report.pdf');
      expect(prisma.knowledgeAttachment.create).toHaveBeenCalled();
    });

    it('图片文件上传成功', async () => {
      const result = await service.addAttachment({
        articleId: 1,
        fileName: 'photo.png',
        fileUrl: '/uploads/knowledge/photo.png',
        fileSize: 512000,
        mimeType: 'image/png',
      });
      expect(result.fileName).toBe('photo.png');
      expect(prisma.knowledgeAttachment.create).toHaveBeenCalled();
    });

    it('文件名被安全处理（路径遍历）', async () => {
      const result = await service.addAttachment({
        articleId: 1,
        fileName: '../etc/passwd.pdf',
        fileUrl: '/uploads/knowledge/test.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
      });
      expect(result.fileName).toBe('_etc_passwd.pdf');
      expect(prisma.knowledgeAttachment.create).toHaveBeenCalled();
    });
  });

  describe('非法文件类型上传失败', () => {
    it('exe 文件被拒绝', async () => {
      try {
        await service.addAttachment({
          articleId: 1,
          fileName: 'malicious.exe',
          fileUrl: '/uploads/knowledge/malicious.exe',
          fileSize: 1000,
          mimeType: 'application/x-msdownload',
        });
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(prisma.knowledgeAttachment.create).not.toHaveBeenCalled();
      }
    });

    it('js 文件被拒绝', async () => {
      try {
        await service.addAttachment({
          articleId: 1,
          fileName: 'script.js',
          fileUrl: '/uploads/knowledge/script.js',
          fileSize: 1000,
          mimeType: 'application/javascript',
        });
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(prisma.knowledgeAttachment.create).not.toHaveBeenCalled();
      }
    });

    it('html 文件被拒绝', async () => {
      try {
        await service.addAttachment({
          articleId: 1,
          fileName: 'page.html',
          fileUrl: '/uploads/knowledge/page.html',
          fileSize: 1000,
          mimeType: 'text/html',
        });
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(prisma.knowledgeAttachment.create).not.toHaveBeenCalled();
      }
    });

    it('svg 文件被拒绝', async () => {
      try {
        await service.addAttachment({
          articleId: 1,
          fileName: 'image.svg',
          fileUrl: '/uploads/knowledge/image.svg',
          fileSize: 1000,
          mimeType: 'image/svg+xml',
        });
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(prisma.knowledgeAttachment.create).not.toHaveBeenCalled();
      }
    });
  });

  describe('文件大小校验', () => {
    it('超过 200MB 的文件被拒绝', async () => {
      try {
        await service.addAttachment({
          articleId: 1,
          fileName: 'large.pdf',
          fileUrl: '/uploads/knowledge/large.pdf',
          fileSize: 201 * 1024 * 1024,
          mimeType: 'application/pdf',
        });
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(e.response.message).toContain('200MB');
        expect(prisma.knowledgeAttachment.create).not.toHaveBeenCalled();
      }
    });
  });

  describe('文章不存在时', () => {
    it('抛出 NotFoundException', async () => {
      prisma.knowledgeArticle.findUnique.mockResolvedValue(null);

      await expect(
        service.addAttachment({
          articleId: 999,
          fileName: 'test.pdf',
          fileUrl: '/uploads/test.pdf',
        })
      ).rejects.toThrow();
      expect(prisma.knowledgeAttachment.create).not.toHaveBeenCalled();
    });
  });
});

describe('KnowledgeService - deleteAttachment 附件删除', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;

  beforeEach(() => {
    process.env.PREVIEW_SECRET = TEST_SECRET;
    prisma = createMockPrisma();
    jwt = createMockJwt();
    service = new KnowledgeService(prisma, jwt);
  });

  const mockAttachment = {
    id: 9,
    articleId: 1,
    fileName: 'export.pdf',
    fileUrl: '/uploads/knowledge/export.pdf',
    fileSize: 2048,
    mimeType: 'application/pdf',
    createdAt: new Date(),
  };

  it('附件不存在时抛出 NotFoundException', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(null);

    await expect(service.deleteAttachment(999)).rejects.toThrow();
    expect(prisma.knowledgeAttachment.delete).not.toHaveBeenCalled();
  });

  // 全局异常过滤器会用中央文案覆盖抛出 message：附件不存在曾写成 5003
  // （=无权限访问该数据），用户看到的是「无权限访问该数据」，与真实原因不符。
  it('附件不存在应返回 5015「附件不存在」，而非 5003「无权限访问该数据」', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(null);

    const err = await service.deleteAttachment(999).catch((e) => e);
    const payload = (err as any)?.getResponse?.() ?? (err as any)?.response ?? err;

    expect(payload.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('附件不存在');
  });

  // 预览 token 为空是「缺参」，曾写成 5004（=知识库分类不存在），
  // 用户会看到「分类不存在」这一与上下文完全无关的提示。
  it('预览 token 为空应返回通用参数校验码 4000，而非 5004「分类不存在」', () => {
    let payload: any;
    try {
      service.verifyPreviewToken('');
    } catch (e: any) {
      payload = e?.getResponse?.() ?? e?.response ?? e;
    }

    expect(payload.code).toBe(ERROR_CODES.PARAM_INVALID);
    expect(messageOf(payload.code)).toBe('参数校验失败');
  });

  it('附件存在时删除并返回 success', async () => {
    prisma.knowledgeAttachment.findUnique.mockResolvedValue(mockAttachment);
    prisma.knowledgeAttachment.delete.mockResolvedValue(mockAttachment);

    const result = await service.deleteAttachment(9);
    expect(prisma.knowledgeAttachment.delete).toHaveBeenCalledWith({ where: { id: 9 } });
    expect(result).toEqual({ success: true });
  });
});

// ----------------------------------------------------------------------
// 附件上传（multipart→FilesService 落盘→入库）与下载通用化（本地/OSS 读流）
// ----------------------------------------------------------------------
describe('KnowledgeService - uploadAttachment / downloadAttachment（FilesService 存储抽象）', () => {
  let service: KnowledgeService;
  let prisma: any;
  let filesService: any;

  beforeEach(() => {
    process.env.PREVIEW_SECRET = TEST_SECRET;
    prisma = createMockPrisma();
    filesService = {
      save: jest.fn(),
      openStream: jest.fn(),
    };
    service = new KnowledgeService(prisma, {} as any, filesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('uploadAttachment - 流式上传附件', () => {
    it('先经 FilesService.save 落盘（本地/OSS），再以返回 URL 入库', async () => {
      prisma.knowledgeArticle.findUnique.mockResolvedValue({ id: 1 });
      filesService.save.mockResolvedValue({ url: '/uploads/knowledge/123-abc.pdf', fileName: '手册.pdf' });
      prisma.knowledgeAttachment.create.mockResolvedValue({ id: 7 });

      const result = await service.uploadAttachment({
        articleId: 1,
        buffer: Buffer.from('pdf-data'),
        fileName: '手册.pdf',
        fileSize: 8,
        mimeType: 'application/pdf',
      });

      expect(filesService.save).toHaveBeenCalledWith(
        Buffer.from('pdf-data'),
        '手册.pdf',
        'knowledge',
      );
      expect(prisma.knowledgeAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 1,
          fileName: '手册.pdf',
          fileUrl: '/uploads/knowledge/123-abc.pdf',
          fileSize: 8,
          mimeType: 'application/pdf',
        }),
      });
      expect(result).toEqual({ id: 7 });
    });

    it('文章不存在时抛异常且不落盘', async () => {
      prisma.knowledgeArticle.findUnique.mockResolvedValue(null);
      await expect(
        service.uploadAttachment({ articleId: 999, buffer: Buffer.from('x'), fileName: 'a.exe' }),
      ).rejects.toThrow(NotFoundException);
      expect(filesService.save).not.toHaveBeenCalled();
    });

    it('扩展名不允许时被校验拦截，不落盘', async () => {
      prisma.knowledgeArticle.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.uploadAttachment({ articleId: 1, buffer: Buffer.from('x'), fileName: 'a.exe' }),
      ).rejects.toThrow(BadRequestException);
      expect(filesService.save).not.toHaveBeenCalled();
    });

    it('文件存储服务未注入时抛异常', async () => {
      const bare = new KnowledgeService(prisma, {} as any, undefined as any);
      prisma.knowledgeArticle.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        bare.uploadAttachment({ articleId: 1, buffer: Buffer.from('x'), fileName: 'a.pdf' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('downloadAttachment - 按存储驱动读流', () => {
    it('经 FilesService.openStream 返回流（本地/OSS 统一）', async () => {
      const fakeStream = { readable: true };
      prisma.knowledgeAttachment.findUnique.mockResolvedValue({
        id: 1,
        articleId: 1,
        fileName: 'a.pdf',
        fileUrl: '/uploads/knowledge/a.pdf',
        mimeType: 'application/pdf',
        article: { status: 'published' },
      });
      filesService.openStream.mockResolvedValue({ stream: fakeStream });

      // 生成可通过校验的预览签名 token
      const signed = signPreviewUrl({
        fileUrl: '/uploads/knowledge/a.pdf',
        fileName: 'a.pdf',
        attachmentId: 1,
        secret: TEST_SECRET,
        expiresIn: 3600,
      });

      const result = await service.downloadAttachment(1, signed.token);
      expect(filesService.openStream).toHaveBeenCalledWith('/uploads/knowledge/a.pdf');
      expect(result.stream).toBe(fakeStream);
      expect(result.fileName).toBe('a.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });
  });

  /**
   * 全局异常过滤器会用中央文案覆盖抛出 message。5002 的中央文案是「token 无效」，
   * 用它承载「权限不足」会让有合法登录态、只是缺 knowledge:view/manage 的用户
   * 看到「token 无效」，排查方向被带偏。
   */
  describe('downloadAttachment - 权限不足必须提示「无权限访问该数据」', () => {
    async function captureCode(fn: () => Promise<unknown>): Promise<number> {
      try {
        await fn();
      } catch (e: any) {
        return (e.getResponse?.() ?? e.response ?? e).code;
      }
      throw new Error('预期抛错但未抛错');
    }

    const publishedAttachment = {
      id: 1,
      articleId: 1,
      fileName: 'a.pdf',
      fileUrl: '/uploads/knowledge/a.pdf',
      mimeType: 'application/pdf',
      article: { status: 'published' },
    };

    it('已发布文章但缺 knowledge:view 时返回 5003，而非 5002', async () => {
      const jwt = createMockJwt();
      jwt.verifyAsync.mockResolvedValue({ sub: 9 });
      const svc = new KnowledgeService(prisma, jwt, filesService);
      prisma.userRole = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.knowledgeAttachment.findUnique.mockResolvedValue(publishedAttachment);

      const code = await captureCode(() =>
        svc.downloadAttachment(1, undefined, 'access_token=valid.jwt.token'),
      );
      expect(code).toBe(ERROR_CODES.DATA_NO_PERMISSION);
      expect(messageOf(code)).toBe('无权限访问该数据');
    });

    it('未发布文章但缺 knowledge:manage 时返回 5003，而非 5002', async () => {
      const jwt = createMockJwt();
      jwt.verifyAsync.mockResolvedValue({ sub: 9 });
      const svc = new KnowledgeService(prisma, jwt, filesService);
      prisma.userRole = { findMany: jest.fn().mockResolvedValue([]) };
      prisma.knowledgeAttachment.findUnique.mockResolvedValue({
        ...publishedAttachment,
        article: { status: 'draft' },
      });

      const code = await captureCode(() =>
        svc.downloadAttachment(1, undefined, 'access_token=valid.jwt.token'),
      );
      expect(code).toBe(ERROR_CODES.DATA_NO_PERMISSION);
      expect(messageOf(code)).toBe('无权限访问该数据');
    });

    it('预览 token 与请求附件不匹配（IDOR）时返回 5003，而非 5002', async () => {
      prisma.knowledgeAttachment.findUnique.mockResolvedValue(publishedAttachment);
      const signed = signPreviewUrl({
        fileUrl: '/uploads/knowledge/other.pdf',
        fileName: 'other.pdf',
        attachmentId: 2,
        secret: TEST_SECRET,
        expiresIn: 3600,
      });

      const code = await captureCode(() => service.downloadAttachment(1, signed.token));
      expect(code).toBe(ERROR_CODES.DATA_NO_PERMISSION);
      expect(messageOf(code)).toBe('无权限访问该数据');
    });
  });
});

describe('KnowledgeService - 分类拖拽排序 reorderCategories', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    process.env.PREVIEW_SECRET = TEST_SECRET;
    prisma = createMockPrisma();
    service = new KnowledgeService(prisma, {} as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('按 ids 顺序批量更新 sortOrder（从 0 递增）', async () => {
    prisma.knowledgeCategory.findMany.mockResolvedValue([{ id: 3 }, { id: 1 }, { id: 2 }]);
    prisma.knowledgeCategory.update.mockResolvedValue({ id: 1 });

    const result = await service.reorderCategories([3, 1, 2]);

    expect(result.success).toBe(true);
    expect(prisma.knowledgeCategory.update).toHaveBeenCalledTimes(3);
    expect(prisma.knowledgeCategory.update).toHaveBeenNthCalledWith(1, {
      where: { id: 3 },
      data: { sortOrder: 0 },
    });
    expect(prisma.knowledgeCategory.update).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      data: { sortOrder: 1 },
    });
    expect(prisma.knowledgeCategory.update).toHaveBeenNthCalledWith(3, {
      where: { id: 2 },
      data: { sortOrder: 2 },
    });
  });

  it('传入的 id 存在缺失时抛 NotFoundException 且不更新', async () => {
    prisma.knowledgeCategory.findMany.mockResolvedValue([{ id: 1 }]);

    await expect(service.reorderCategories([1, 99])).rejects.toThrow(NotFoundException);
    expect(prisma.knowledgeCategory.update).not.toHaveBeenCalled();
  });

  it('空数组直接返回成功', async () => {
    prisma.knowledgeCategory.findMany.mockResolvedValue([]);

    const result = await service.reorderCategories([]);
    expect(result.success).toBe(true);
    expect(prisma.knowledgeCategory.update).not.toHaveBeenCalled();
  });
});

// public 列表只返回 status='published' 的文章，详情接口却没有同样的约束：
// 任何登录用户都能通过 /knowledge/articles/:id 读到草稿/下线文章（信息泄漏）。
describe('KnowledgeService - 文章可见性（草稿不得对普通读者暴露）', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    process.env.PREVIEW_SECRET = TEST_SECRET;
    prisma = createMockPrisma();
    service = new KnowledgeService(prisma, {} as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('非 published 文章对普通读者按「不存在」处理，且不累加阅读量', async () => {
    prisma.knowledgeArticle.findUnique.mockResolvedValue({
      id: 1,
      status: 'draft',
      deletedAt: null,
      viewCount: 0,
    });

    await expect(service.getArticleDetail(1)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.knowledgeArticle.update).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('管理端显式预览时可读取草稿', async () => {
    prisma.knowledgeArticle.findUnique.mockResolvedValue({
      id: 1,
      status: 'draft',
      deletedAt: null,
      viewCount: 0,
    });
    prisma.knowledgeArticle.update.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);

    const result = await service.getArticleDetail(1, { includeUnpublished: true });

    expect(result.id).toBe(1);
  });

  it('published 文章对普通读者正常可见', async () => {
    prisma.knowledgeArticle.findUnique.mockResolvedValue({
      id: 1,
      status: 'published',
      deletedAt: null,
      viewCount: 3,
    });
    prisma.knowledgeArticle.update.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);

    const result = await service.getArticleDetail(1);

    expect(result.viewCount).toBe(4);
  });

  it('管理端列表可通过 includeUnpublished 包含未发布文章', async () => {
    prisma.knowledgeArticle.findMany.mockResolvedValue([]);
    prisma.knowledgeArticle.count.mockResolvedValue(0);

    await service.listArticles({ page: 1, pageSize: 20, includeUnpublished: true });

    const where = prisma.knowledgeArticle.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(where.deletedAt).toBeNull();
  });

  it('public 列表默认仍只看已发布文章', async () => {
    prisma.knowledgeArticle.findMany.mockResolvedValue([]);
    prisma.knowledgeArticle.count.mockResolvedValue(0);

    await service.listArticles({ page: 1, pageSize: 20 });

    const where = prisma.knowledgeArticle.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('published');
  });
});

// 阅读统计的日期列是 @db.Date（业务日），生产容器 TZ=UTC 时用服务器本地日期/UTC 日期
// 会把北京 00:00~08:00 的阅读记到前一天，且「今日阅读量」用带时分秒的 new Date() 等值匹配
// 日期列永远匹配不到（恒为 0）。
describe('KnowledgeService - 阅读统计按北京业务日', () => {
  let service: KnowledgeService;
  let prisma: ReturnType<typeof createMockPrisma>;

  // 北京 2026-10-01 01:00 === UTC 2026-09-30 17:00
  const BEIJING_CROSS_DAY = new Date('2026-09-30T17:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(BEIJING_CROSS_DAY);
    process.env.PREVIEW_SECRET = TEST_SECRET;
    prisma = createMockPrisma();
    service = new KnowledgeService(prisma, {} as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('按天累计写入北京业务日（2026-10-01），而非 UTC 日期（2026-09-30）', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await (service as any).incrementDailyStat(7);

    expect(prisma.$executeRaw.mock.calls[0][2]).toBe('2026-10-01');
  });

  it('今日阅读量按北京业务日（00:00:00）聚合，避免带时分秒的等值匹配落空', async () => {
    prisma.knowledgeArticle.count.mockResolvedValue(0);
    prisma.knowledgeCategory.count.mockResolvedValue(0);
    prisma.knowledgeArticle.aggregate.mockResolvedValue({ _sum: { viewCount: 0 } });
    prisma.knowledgeArticleDailyStat.aggregate.mockResolvedValue({ _sum: { viewCount: 5 } });

    const result = await service.getKnowledgeSummary();

    expect(prisma.knowledgeArticleDailyStat.aggregate).toHaveBeenCalledWith({
      where: { date: new Date('2026-10-01T00:00:00.000Z') },
      _sum: { viewCount: true },
    });
    expect(result.todayViews).toBe(5);
  });

  it('近 N 天统计的起始日按北京业务日回溯', async () => {
    prisma.knowledgeArticle.findUnique.mockResolvedValue({ id: 1 });
    prisma.knowledgeArticleDailyStat.findMany.mockResolvedValue([]);

    await service.getArticleDailyStats(1, 7);

    const where = prisma.knowledgeArticleDailyStat.findMany.mock.calls[0][0].where;
    expect(where.date.gte.toISOString()).toBe('2026-09-25T00:00:00.000Z');
  });
});
