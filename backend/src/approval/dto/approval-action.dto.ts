import { IsString, IsOptional } from 'class-validator';

/**
 * 审批通过/驳回通用入参（仅评论可选）。
 * 被 approval.controller 的 approve / reject 端点复用。
 */
export class ApprovalActionDto {
  @IsString()
  @IsOptional()
  comment?: string;
}
