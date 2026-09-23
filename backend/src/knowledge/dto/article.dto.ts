import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateArticleDto {
  @IsInt()
  categoryId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  /** 前端会提交摘要字段（tar-normal 对齐文章列表卡片）；@IsOptional + whitelist 允许透传 */
  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateArticleDto {
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
