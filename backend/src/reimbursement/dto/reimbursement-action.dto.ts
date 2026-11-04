import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 报销审批通过入参：审批意见可选。
 * 报销动作最终经 APPROVAL_CLIENT 推进审批实例（ADR-0013），comment 即审批意见。
 */
export class ApproveReimbursementDto {
  @IsString()
  @IsOptional()
  comment?: string;
}

/**
 * 报销审批驳回入参：驳回原因必填。
 * 空串 / 纯空格 / 缺省都会被全局 ValidationPipe 拦为 400（PARAM_INVALID 4000），
 * 与 service 层的二次校验共同兜底，避免出现无原因的驳回记录。
 */
export class RejectReimbursementDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: '驳回原因不能为空' })
  comment!: string;
}
