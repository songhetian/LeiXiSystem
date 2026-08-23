import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateArticleDto {
  @IsInt()
  categoryId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  content?: string;
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
  content?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
