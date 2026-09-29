import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PermissionCacheService } from '../common/permission-cache.service';
import { KnowledgeService } from './knowledge.service';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from './dto/category.dto';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import { AddAttachmentDto } from './dto/attachment.dto';
import { parsePagination } from '../common/pagination.util';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly permCache: PermissionCacheService,
  ) {}

  /** 当前用户是否具备知识库管理权限（用于草稿预览/管理端列表） */
  private async canManage(req: any): Promise<boolean> {
    const perms = await this.permCache.getUserPermissions(req.user.id);
    return perms.has('knowledge:manage');
  }

  // ===== 分类 =====
  @Get('categories')
  @HttpCode(200)
  async listCategories() {
    const data = await this.knowledgeService.listCategories();
    return { code: 0, data };
  }

  @Post('categories')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async createCategory(@Body() body: CreateCategoryDto) {
    const data = await this.knowledgeService.createCategory(body.name, body.sortOrder);
    return { code: 0, data };
  }

  // 注意：reorder 必须在 categories/:id 之前声明，避免 ParseIntPipe 把 'reorder' 当数字解析
  @Put('categories/reorder')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async reorderCategories(@Body() body: ReorderCategoriesDto) {
    const data = await this.knowledgeService.reorderCategories(body.ids);
    return { code: 0, data };
  }

  @Put('categories/:id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCategoryDto,
  ) {
    const data = await this.knowledgeService.updateCategory(id, body.name, body.sortOrder);
    return { code: 0, data };
  }

  @Delete('categories/:id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.deleteCategory(id);
    return { code: 0, data };
  }

  // ===== 文章 =====
  @Get('articles')
  @HttpCode(200)
  async listArticles(
    @Req() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('includeUnpublished') includeUnpublished?: string,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    // 未发布文章只能由具备 knowledge:manage 的用户显式拉取（管理端）
    const withUnpublished = includeUnpublished === 'true' && (await this.canManage(req));
    const data = await this.knowledgeService.listArticles({
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      keyword,
      page: pageNum,
      pageSize: pageSizeNum,
      includeUnpublished: withUnpublished,
    });
    return { code: 0, data };
  }

  @Get('articles/:id')
  @HttpCode(200)
  async getArticle(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const includeUnpublished = await this.canManage(req);
    const data = await this.knowledgeService.getArticleDetail(id, { includeUnpublished });
    return { code: 0, data };
  }

  @Post('articles')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async createArticle(@Body() body: CreateArticleDto, @Req() req: any) {
    const data = await this.knowledgeService.createArticle({
      categoryId: body.categoryId,
      title: body.title,
      summary: body.summary,
      content: body.content,
      status: body.status,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Put('articles/:id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async updateArticle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateArticleDto,
  ) {
    const data = await this.knowledgeService.updateArticle(id, body);
    return { code: 0, data };
  }

  @Delete('articles/:id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async deleteArticle(@Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.deleteArticle(id);
    return { code: 0, data };
  }

  @Post('articles/:id/restore')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async restoreArticle(@Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.restoreArticle(id);
    return { code: 0, data };
  }

  // ===== 附件 =====
  @Get('articles/:id/attachments')
  @HttpCode(200)
  async listAttachments(@Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.listAttachments(id);
    return { code: 0, data };
  }

  @Post('articles/:id/attachments')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async addAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddAttachmentDto,
  ) {
    const data = await this.knowledgeService.addAttachment({
      articleId: id,
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
    });
    return { code: 0, data };
  }

  @Delete('articles/:id/attachments/:attId')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async removeAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('attId', ParseIntPipe) attId: number,
  ) {
    const data = await this.knowledgeService.deleteAttachment(attId);
    return { code: 0, data };
  }

  /**
   * 知识库附件上传（multipart）：POST /api/v1/knowledge/articles/:id/attachments/upload
   * Fastify 内核解析 multipart，经 Finals：FilesService 落盘（本地/OSS）+ 入库。
   */
  @Post('articles/:id/attachments/upload')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException({ code: 4000, message: '请选择文件' });
    }
    const buffer = await file.toBuffer();
    const data = await this.knowledgeService.uploadAttachment({
      articleId: id,
      buffer,
      fileName: file.filename || 'file',
      fileSize: buffer.length,
      mimeType: file.mimetype,
    });
    return { code: 0, data };
  }

  // ===== 预览签名 =====
  @Get('preview-url')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:view')
  async getPreviewUrl(@Query('attachmentId', ParseIntPipe) attachmentId: number) {
    const data = await this.knowledgeService.getPreviewUrl(attachmentId);
    return { code: 0, data };
  }

  // ===== 阅读统计 =====
  @Get('articles/:id/stats/daily')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async getArticleDailyStats(
    @Param('id', ParseIntPipe) id: number,
    @Query('days') days?: string,
  ) {
    const data = await this.knowledgeService.getArticleDailyStats(
      id,
      days ? parseInt(days) : 7,
    );
    return { code: 0, data };
  }

  @Get('stats/summary')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async getKnowledgeSummary() {
    const data = await this.knowledgeService.getKnowledgeSummary();
    return { code: 0, data };
  }
}

@Controller('knowledge')
export class KnowledgePublicController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('preview-verify')
  @HttpCode(200)
  async verifyPreview(@Query('token') token?: string) {
    const data = this.knowledgeService.verifyPreviewToken(token || '');
    return { code: 0, data };
  }

  // ===== 附件下载（验证预览 token 或 JWT）=====
  @Get('attachments/:id/download')
  async downloadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Query('token') token: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const cookieHeader: string | undefined = req.headers?.cookie;
    const { stream, fileName, mimeType } = await this.knowledgeService.downloadAttachment(
      id,
      token,
      cookieHeader,
    );
    res.header('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.type(mimeType);
    res.send(stream);
  }
}
