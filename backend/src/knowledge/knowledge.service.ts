import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ERROR_CODES } from '../common/error-codes';
import { signPreviewUrl, verifyPreviewToken } from './engine/preview-sign';
import { validateAttachment } from './engine/attachment-security.util';

@Injectable()
export class KnowledgeService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly filesService?: FilesService,
  ) {}

  private readonly previewSecret = process.env.PREVIEW_SECRET || '';
  private readonly previewExpiresIn = 3600;

  // ===== 分类 =====
  async listCategories() {
    return this.prisma.knowledgeCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async createCategory(name: string, sortOrder?: number) {
    return this.prisma.knowledgeCategory.create({
      data: { name, sortOrder: sortOrder || 0 },
    });
  }

  async updateCategory(id: number, name: string, sortOrder?: number) {
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!cat) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_CATEGORY_NOT_FOUND, message: '分类不存在' });
    }
    return this.prisma.knowledgeCategory.update({
      where: { id },
      data: { name, sortOrder },
    });
  }

  async deleteCategory(id: number) {
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!cat) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_CATEGORY_NOT_FOUND, message: '分类不存在' });
    }
    await this.prisma.knowledgeCategory.delete({ where: { id } });
    return { success: true };
  }

  /**
   * 拖拽排序：按传入的 ids 顺序（从 0 递增）批量更新 sortOrder。
   */
  async reorderCategories(ids: number[]) {
    if (ids.length === 0) return { success: true };

    const existing = await this.prisma.knowledgeCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_CATEGORY_NOT_FOUND, message: '部分分类不存在' });
    }

    await Promise.all(
      ids.map((id, index) =>
        this.prisma.knowledgeCategory.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  // ===== 文章 =====
  async listArticles(params: {
    categoryId?: number;
    keyword?: string;
    page: number;
    pageSize: number;
  }) {
    const { categoryId, keyword, page, pageSize } = params;
    const where: any = { status: 'published', deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (keyword) where.title = { contains: keyword };

    const [list, total] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async getArticleDetail(id: number) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        attachments: true,
      },
    });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }
    await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    await this.incrementDailyStat(id);
    return { ...article, viewCount: article.viewCount + 1 };
  }

  async createArticle(params: {
    categoryId: number;
    title: string;
    summary?: string;
    content?: string;
    status?: string;
    userId: number;
  }) {
    const { categoryId, title, summary, content, status, userId } = params;
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id: categoryId } });
    if (!cat) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_CATEGORY_NOT_FOUND, message: '分类不存在' });
    }
    return this.prisma.knowledgeArticle.create({
      data: {
        categoryId,
        title,
        summary,
        content,
        status: status || 'published',
        createdBy: userId,
      },
    });
  }

  async updateArticle(id: number, params: {
    categoryId?: number;
    title?: string;
    summary?: string;
    content?: string;
    status?: string;
  }) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id, deletedAt: null } });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: params,
    });
  }

  async deleteArticle(id: number) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id, deletedAt: null } });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }
    await this.prisma.knowledgeArticle.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async restoreArticle(id: number) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }
    if (!article.deletedAt) {
      throw new ConflictException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_DELETED, message: '文章未被删除，不可恢复' });
    }
    await this.prisma.knowledgeArticle.update({ where: { id }, data: { deletedAt: null } });
    return { success: true };
  }

  // ===== 附件 =====
  async listAttachments(articleId: number) {
    return this.prisma.knowledgeAttachment.findMany({
      where: { articleId },
      orderBy: { id: 'asc' },
    });
  }

  async addAttachment(params: {
    articleId: number;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
  }) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: params.articleId },
    });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }

    const validation = validateAttachment({
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
    });
    if (!validation.valid) {
      throw new BadRequestException({
        code: validation.errorCode ?? ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
        message: validation.message ?? '附件校验失败',
      });
    }

    return this.prisma.knowledgeAttachment.create({
      data: {
        ...params,
        fileName: validation.sanitizedFileName ?? params.fileName,
      },
    });
  }

  async deleteAttachment(id: number) {
    const att = await this.prisma.knowledgeAttachment.findUnique({ where: { id } });
    if (!att) {
      throw new NotFoundException({ code: 5003, message: '附件不存在' });
    }
    await this.prisma.knowledgeAttachment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * 上传知识库附件：二进制流先经 FilesService 落盘（本地磁盘 / OSS 由 FILE_STORAGE 决定），
   * 校验通过后登记为文章附件。
   */
  async uploadAttachment(params: {
    articleId: number;
    buffer: Buffer;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
  }) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: params.articleId },
    });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }

    const validation = validateAttachment({
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
    });
    if (!validation.valid) {
      throw new BadRequestException({
        code: validation.errorCode ?? ERROR_CODES.KNOWLEDGE_ATTACHMENT_INVALID,
        message: validation.message ?? '附件校验失败',
      });
    }

    if (!this.filesService) {
      throw new BadRequestException({ code: ERROR_CODES.INTERNAL_ERROR, message: '文件存储服务未就绪' });
    }
    const saved = await this.filesService.save(params.buffer, params.fileName, 'knowledge');

    return this.prisma.knowledgeAttachment.create({
      data: {
        articleId: params.articleId,
        fileName: validation.sanitizedFileName ?? params.fileName,
        fileUrl: saved.url,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
      },
    });
  }

  // ===== 预览签名 =====
  async getPreviewUrl(attachmentId: number) {
    if (!this.previewSecret) {
      throw new BadRequestException({ code: ERROR_CODES.INTERNAL_ERROR, message: '预览功能未配置：请设置 PREVIEW_SECRET 环境变量' });
    }
    const att = await this.prisma.knowledgeAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!att) {
      throw new NotFoundException({ code: 5003, message: '附件不存在' });
    }
    const result = signPreviewUrl({
      fileUrl: att.fileUrl,
      fileName: att.fileName,
      attachmentId: att.id,
      secret: this.previewSecret,
      expiresIn: this.previewExpiresIn,
    });
    // 返回前端路由 URL，由前端页面使用 Open-File-Viewer 渲染
    return {
      previewUrl: `/knowledge/preview/${attachmentId}?token=${result.token}`,
      expiresAt: result.expiresAt,
      fileName: att.fileName,
    };
  }

  // ===== 预览 token 验证 =====
  verifyPreviewToken(token: string) {
    if (!token) {
      throw new BadRequestException({ code: 5004, message: 'token 不能为空' });
    }
    const result = verifyPreviewToken(token, this.previewSecret);
    if (!result.valid) {
      return { valid: false, error: result.error };
    }
    return {
      valid: true,
      fileUrl: result.payload!.fileUrl,
      fileName: result.payload!.fileName,
      attachmentId: result.payload!.attachmentId,
      expiresAt: result.payload!.exp * 1000,
    };
  }

  // ===== 附件下载（验证预览 token 或 JWT）=====
  async downloadAttachment(attachmentId: number, token?: string, cookieHeader?: string) {
    // 1. 鉴权：优先验证预览 token，否则尝试 JWT cookie
    let authorized = false;
    let tokenFileUrl: string | undefined;
    let jwtUserId: number | undefined;

    if (token) {
      const result = this.verifyPreviewToken(token);
      if (result.valid) {
        authorized = true;
        tokenFileUrl = result.fileUrl;
      }
    }

    if (!authorized && cookieHeader) {
      const jwtToken = cookieHeader
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('access_token='))
        ?.split('=')[1];
      if (jwtToken) {
        try {
          const payload = await this.jwt.verifyAsync(jwtToken);
          authorized = true;
          jwtUserId = payload.sub;
        } catch {
          // JWT 无效，继续
        }
      }
    }

    if (!authorized) {
      throw new UnauthorizedException({ code: 5002, message: '无权限下载该附件' });
    }

    // 2. 查找附件（含文章状态）
    const att = await this.prisma.knowledgeAttachment.findUnique({
      where: { id: attachmentId },
      include: { article: { select: { status: true } } },
    });
    if (!att) {
      throw new NotFoundException({ code: 5003, message: '附件不存在' });
    }

    // 3. IDOR 防护：如果通过预览 token 鉴权，校验 token 中的 fileUrl 与附件的 fileUrl 一致
    if (tokenFileUrl !== undefined && tokenFileUrl !== att.fileUrl) {
      throw new ForbiddenException({ code: 5002, message: 'token 与请求的附件不匹配' });
    }

    // 4. JWT cookie 路径：权限校验 + published 状态校验
    //    已发布文章 → 需要 knowledge:view 权限
    //    未发布文章 → 需要 knowledge:manage 权限
    if (jwtUserId !== undefined) {
      const userPerms = await this.getUserPermissions(jwtUserId);
      const isPublished = att.article?.status === 'published';
      if (isPublished) {
        if (!userPerms.includes('knowledge:view')) {
          throw new ForbiddenException({ code: 5002, message: '无权限下载该附件' });
        }
      } else {
        if (!userPerms.includes('knowledge:manage')) {
          throw new ForbiddenException({ code: 5002, message: '无权限下载该附件' });
        }
      }
    }

    // 5. 按当前存储驱动（本地磁盘 / OSS）打开文件读流
    if (!this.filesService) {
      throw new BadRequestException({ code: ERROR_CODES.INTERNAL_ERROR, message: '文件存储服务未就绪' });
    }
    const { stream } = await this.filesService.openStream(att.fileUrl);
    return {
      stream,
      fileName: att.fileName,
      mimeType: att.mimeType || 'application/octet-stream',
    };
  }

  // ===== 查询用户权限列表 =====
  private async getUserPermissions(userId: number): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    const perms = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        perms.add(rp.permission.code);
      }
    }
    return Array.from(perms);
  }

  // ===== 阅读统计 =====
  async getArticleDailyStats(articleId: number, days: number = 7) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const stats = await this.prisma.knowledgeArticleDailyStat.findMany({
      where: {
        articleId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return stats.map(s => ({
      date: s.date,
      viewCount: s.viewCount,
      uniqueViewers: s.uniqueViewers,
    }));
  }

  async getKnowledgeSummary() {
    const [totalArticles, totalCategories, totalViewsResult, todayStats] = await Promise.all([
      this.prisma.knowledgeArticle.count(),
      this.prisma.knowledgeCategory.count(),
      this.prisma.knowledgeArticle.aggregate({ _sum: { viewCount: true } }),
      this.prisma.knowledgeArticleDailyStat.aggregate({
        where: { date: new Date() },
        _sum: { viewCount: true },
      }),
    ]);

    return {
      totalArticles,
      totalCategories,
      totalViews: totalViewsResult._sum.viewCount || 0,
      todayViews: todayStats._sum.viewCount || 0,
    };
  }

  private async incrementDailyStat(articleId: number) {
    const todayStr = new Date().toISOString().split('T')[0];
    await this.prisma.$executeRaw`
      INSERT INTO knowledge_article_daily_stats (article_id, date, view_count, unique_viewers)
      VALUES (${articleId}, ${todayStr}, 1, 1)
      ON DUPLICATE KEY UPDATE view_count = view_count + 1
    `;
  }
}
