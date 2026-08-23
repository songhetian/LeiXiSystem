import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
