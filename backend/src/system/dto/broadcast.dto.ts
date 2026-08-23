import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsInt,
  IsIn,
} from 'class-validator';

export class CreateBroadcastDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsIn(['all', 'department', 'user'])
  @IsOptional()
  recipientType?: 'all' | 'department' | 'user';

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  recipientDepartmentIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  recipientUserIds?: number[];
}

export class UpdateBroadcastDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsIn(['all', 'department', 'user'])
  @IsOptional()
  recipientType?: 'all' | 'department' | 'user';

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  recipientDepartmentIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  recipientUserIds?: number[];
}
