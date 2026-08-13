import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';
import { signPreviewUrl, verifyPreviewToken } from './engine/preview-sign';

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

  private readonly previewSecret = process.env.PREVIEW_SECRET || 'default-preview-secret-change-me';
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
    const where: any = { status: 'published' };
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
      where: { id },
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
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: params,
    });
  }

  async deleteArticle(id: number) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException({ code: ERROR_CODES.KNOWLEDGE_ARTICLE_NOT_FOUND, message: '文章不存在' });
    }
    await this.prisma.knowledgeArticle.delete({ where: { id } });
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
    return this.prisma.knowledgeAttachment.create({
      data: params,
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
    const att = await this.prisma.knowledgeAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!att) {
      throw new NotFoundException({ code: 5003, message: '附件不存在' });
    }
    const result = signPreviewUrl({
      fileUrl: att.fileUrl,
      fileName: att.fileName,
      secret: this.previewSecret,
      expiresIn: this.previewExpiresIn,
    });
    return {
      previewUrl: result.previewUrl,
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
      expiresAt: result.payload!.exp * 1000,
    };
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
