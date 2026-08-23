import { KnowledgeService } from './knowledge.service';
import { verifyPreviewToken } from './engine/preview-sign';
import { ERROR_CODES } from '../common/error-codes';
import { BadRequestException } from '@nestjs/common';

// Mock PrismaService
function createMockPrisma() {
  const knowledgeAttachment = {
    findUnique: jest.fn(),
    create: jest.fn(),
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
    it('超过 10MB 的文件被拒绝', async () => {
      try {
        await service.addAttachment({
          articleId: 1,
          fileName: 'large.pdf',
          fileUrl: '/uploads/knowledge/large.pdf',
          fileSize: 11 * 1024 * 1024,
          mimeType: 'application/pdf',
        });
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response.code).toBe(ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID);
        expect(e.response.message).toContain('10MB');
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
