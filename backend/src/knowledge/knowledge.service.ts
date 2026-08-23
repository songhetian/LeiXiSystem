import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';
import { signPreviewUrl, verifyPreviewToken } from './engine/preview-sign';
import { validateAttachment } from './engine/attachment-security.util';
import { resolve, sep, isAbsolute } from 'path';
import { existsSync, realpathSync } from 'fs';

@Injectable()
export class KnowledgeService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
    content?: string;
    userId: number;
  }) {
    const { categoryId, title, content, userId } = params;
    const cat = await this.prisma.knowledgeCategory.findUnique({ where: { id: categoryId } });
    if (!cat) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_CATEGORY_NOT_FOUND, message: '分类不存在' });
    }
    return this.prisma.knowledgeArticle.create({
      data: {
        categoryId,
        title,
        content,
        createdBy: userId,
      },
    });
  }

  async updateArticle(id: number, params: {
    categoryId?: number;
    title?: string;
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

    // 5. 解析文件路径
    const filePath = this.resolveFilePath(att.fileUrl);
    if (!existsSync(filePath)) {
      throw new NotFoundException({ code: 5003, message: '文件不存在或已被删除' });
    }

    return {
      filePath,
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

  // ===== 文件路径解析 =====
  private resolveFilePath(fileUrl: string): string {
    // 远程 URL 不支持直接下载
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      throw new BadRequestException({ code: ERROR_CODES.INTERNAL_ERROR, message: '不支持远程文件下载' });
    }

    const uploadsBase = resolve(process.cwd(), 'uploads');
    const uploadsBaseWithSep = uploadsBase + sep;

    // 解析为绝对路径并规范化 ".." 段
    let filePath: string;
    if (fileUrl.startsWith('/uploads/')) {
      // 去掉前导斜杠，使其相对于 cwd 解析
      filePath = resolve(process.cwd(), fileUrl.slice(1));
    } else if (isAbsolute(fileUrl)) {
      filePath = resolve(fileUrl);
    } else {
      filePath = resolve(process.cwd(), fileUrl);
    }

    // 安全检查：解析后的路径必须在 uploads 目录内，防止路径遍历
    if (filePath !== uploadsBase && !filePath.startsWith(uploadsBaseWithSep)) {
      throw new BadRequestException({ code: ERROR_CODES.INTERNAL_ERROR, message: '非法文件路径' });
    }

    // realpath 校验：防止符号链接逃逸
    // 攻击者可能在 uploads 目录内创建指向外部的符号链接，前缀检查会通过但 createReadStream 会跟随链接
    let realPath: string;
    try {
      realPath = realpathSync(filePath);
    } catch {
      throw new NotFoundException({ code: 5003, message: '文件不存在或已被删除' });
    }
    if (realPath !== uploadsBase && !realPath.startsWith(uploadsBaseWithSep)) {
      throw new BadRequestException({ code: ERROR_CODES.INTERNAL_ERROR, message: '非法文件路径' });
    }

    return realPath;
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
