import { IsString, IsNotEmpty, IsOptional, IsInt, IsNumber } from 'class-validator';

export class CreateLeaveRecordDto {
  @IsInt()
  employeeId!: number;

  @IsInt()
  vacationTypeId!: number;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @IsNumber()
  days!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/**
 * 请假审批通过/驳回通用入参（仅评论可选）。
 * 被 leave-records.controller 的 approve / reject 端点复用。
 */
export class LeaveActionDto {
  @IsString()
  @IsOptional()
  comment?: string;
}
