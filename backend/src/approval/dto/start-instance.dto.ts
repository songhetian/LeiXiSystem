import { IsString, IsNotEmpty, IsOptional, IsInt, IsObject } from 'class-validator';

export class StartInstanceDto {
  @IsString()
  @IsNotEmpty()
  workflowCode!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsObject()
  @IsOptional()
  formData?: Record<string, any>;

  @IsInt()
  @IsOptional()
  departmentId?: number;
}
