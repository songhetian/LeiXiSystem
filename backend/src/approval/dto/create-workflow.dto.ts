import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  ValidateNested,
} from 'class-validator';

export class CreateWorkflowNodeDto {
  @IsString()
  @IsNotEmpty()
  nodeKey!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  roleCode?: string;

  @IsInt()
  @IsOptional()
  approvalGroupId?: number;

  @IsInt()
  order!: number;

  @IsString()
  @IsOptional()
  conditionField?: string;

  @IsString()
  @IsOptional()
  conditionOperator?: string;

  @IsString()
  @IsOptional()
  conditionValue?: string;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  module!: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @IsOptional()
  maxResubmits?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowNodeDto)
  @IsOptional()
  nodes?: CreateWorkflowNodeDto[];
}
