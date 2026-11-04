// RBAC 强制标准（REFACTOR_PLAN 11.6-3 + ADR-0019）：审批写端点必须用
// 发起/处理类权限点守卫，不得用查看类权限点（可越权直调）。
// 这里断言装饰器元数据绑定正确——PermissionGuard 以该元数据为唯一判定输入，
// 403/放行行为本身由 permission.guard.spec.ts 覆盖。
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ApprovalController } from './approval.controller';
import { RejectApprovalActionDto } from './dto/approval-action.dto';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof ApprovalController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, ApprovalController.prototype[method]);

describe('ApprovalController — 端点权限矩阵（ADR-0019）', () => {
  it('处理端点 approve/reject/transfer/addSign 挂 approval:process（此前只挂 todo:view，可越权直调）', () => {
    expect(permOf('approve')).toBe('approval:process');
    expect(permOf('reject')).toBe('approval:process');
    expect(permOf('transfer')).toBe('approval:process');
    expect(permOf('addSign')).toBe('approval:process');
  });

  it('发起/重提端点 startInstance/resubmit 挂 approval:apply（staff 角色已补绑，见 seed）', () => {
    expect(permOf('startInstance')).toBe('approval:apply');
    expect(permOf('resubmit')).toBe('approval:apply');
  });

  it('查看端点保持查看类权限点（回归保护）', () => {
    expect(permOf('listTodos')).toBe('approval:todo:view');
    expect(permOf('listMyApproved')).toBe('approval:todo:view');
    expect(permOf('listAvailableWorkflows')).toBe('approval:submitted:view');
    expect(permOf('getInstance')).toBe('approval:submitted:view');
    expect(permOf('listMySubmissions')).toBe('approval:submitted:view');
  });

  it('流程配置端点保持 approval:workflow:manage（回归保护）', () => {
    expect(permOf('listWorkflows')).toBe('approval:workflow:manage');
    expect(permOf('getWorkflow')).toBe('approval:workflow:manage');
    expect(permOf('createWorkflow')).toBe('approval:workflow:manage');
    expect(permOf('updateWorkflow')).toBe('approval:workflow:manage');
    expect(permOf('deleteWorkflow')).toBe('approval:workflow:manage');
    expect(permOf('restoreWorkflow')).toBe('approval:workflow:manage');
    expect(permOf('createCommentTemplate')).toBe('approval:workflow:manage');
    expect(permOf('updateCommentTemplate')).toBe('approval:workflow:manage');
    expect(permOf('deleteCommentTemplate')).toBe('approval:workflow:manage');
  });
});

// 驳回原因必填：报销/请假等所有走审批流驳回的场景都不允许空原因。
describe('RejectApprovalActionDto — 驳回原因必填（B5）', () => {
  const errorsOf = (payload: Record<string, any>) =>
    validate(plainToInstance(RejectApprovalActionDto, payload));

  it('缺省 comment 时校验失败（400 PARAM_INVALID）', async () => {
    expect(await errorsOf({})).not.toHaveLength(0);
  });

  it('空串 / 纯空格同样校验失败', async () => {
    expect(await errorsOf({ comment: '' })).not.toHaveLength(0);
    expect(await errorsOf({ comment: '   ' })).not.toHaveLength(0);
  });

  it('填写原因后通过校验（首尾空格被裁剪）', async () => {
    const dto = plainToInstance(RejectApprovalActionDto, { comment: '  发票不齐全  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.comment).toBe('发票不齐全');
  });
});
