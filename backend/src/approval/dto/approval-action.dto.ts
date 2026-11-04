import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 审批通过/驳回通用入参（仅评论可选）。
 * 被 approval.controller 的 approve / reject 端点复用。
 */
export class ApprovalActionDto {
  @IsString()
  @IsOptional()
  comment?: string;
}

/**
 * 驳回入参：驳回原因必填。
 * 空串 / 纯空格 / 缺省都会被 Global ValidationPipe 拦为 400（PARAM_INVALID 4000），
 * 避免审批流里出现无原因的驳回记录。
 */
export class RejectApprovalActionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: '驳回原因不能为空' })
  comment!: string;
}
