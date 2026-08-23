import { IsString, IsNotEmpty, IsOptional, IsNumber, IsInt } from 'class-validator';

export class CreateSalaryItemDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsNumber()
  @IsOptional()
  rate?: number;

  @IsString()
  @IsOptional()
  formula?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateSalaryItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsNumber()
  @IsOptional()
  rate?: number;

  @IsString()
  @IsOptional()
  formula?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
