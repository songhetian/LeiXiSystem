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
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

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
  async createCategory(@Body() body: any) {
    const data = await this.knowledgeService.createCategory(body.name, body.sortOrder);
    return { code: 0, data };
  }

  @Put('categories/:id')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
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
    @Query('categoryId') categoryId?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.knowledgeService.listArticles({
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      keyword,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return { code: 0, data };
  }

  @Get('articles/:id')
  @HttpCode(200)
  async getArticle(@Param('id', ParseIntPipe) id: number) {
    const data = await this.knowledgeService.getArticleDetail(id);
    return { code: 0, data };
  }

  @Post('articles')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission('knowledge:manage')
  async createArticle(@Body() body: any, @Req() req: any) {
    const data = await this.knowledgeService.createArticle({
      categoryId: body.categoryId,
      title: body.title,
      content: body.content,
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
    @Body() body: any,
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
    @Body() body: any,
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
}
