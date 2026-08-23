import { IsString, IsNotEmpty, IsOptional, IsInt, IsNumber } from 'class-validator';

export class CreateOvertimeDto {
  @IsInt()
  employeeId!: number;

  @IsString()
  @IsNotEmpty()
  overtimeDate!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsNumber()
  hours!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * 加班审批通过/驳回通用入参（仅评论可选）。
 * 被 overtime-records.controller 的 approve / reject 端点复用。
 */
export class OvertimeActionDto {
  @IsString()
  @IsOptional()
  comment?: string;
}
