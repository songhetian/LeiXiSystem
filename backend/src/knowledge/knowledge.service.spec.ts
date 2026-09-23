import { KnowledgeService } from './knowledge.service';
import { verifyPreviewToken, signPreviewUrl } from './engine/preview-sign';
import { ERROR_CODES } from '../common/error-codes';
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
