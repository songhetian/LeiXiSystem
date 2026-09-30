// 审批重新提交的次数上限必须由数据库条件保证（缺陷 P2-8）
// 背景：resubmit 先在事务外读快照判定 resubmitCount >= maxResubmits，随后递增。
// 两个并发重提都能通过旧快照判定 → 次数可被突破。改为单条 CAS：
// updateMany({ where: { id, status: {in:[rejected,cancelled]}, resubmitCount: {lt: max} }, ... })
// count===0 即中止（且不得产生任何副作用）。
import { describe, it, expect, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ApprovalService } from '../src/approval/approval.service';
import { ERROR_CODES } from '../src/common/error-codes';

const MAX_RESUBMITS = 2;

function makeInstance() {
  return {
    id: 1,
    status: 'rejected',
    applicantId: 7,
    departmentId: 2,
    workflowId: 10,
    workflowCode: 'leave',
    formData: '{}',
    resubmitCount: 0,
    title: '请假申请',
    records: [],
    workflow: {
      id: 10,
      module: 'attendance',
      maxResubmits: MAX_RESUBMITS,
      nodes: [
        { id: 1, nodeKey: 'n1', name: '申请人确认', type: 'initiator', order: 1 },
      ],
    },
  };
}

function makeService(casCount: number) {
  let casArgs: any;
  const tx = {
    approvalRecord: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 1 })),
      findFirst: jest.fn(async () => null),
    },
    approvalInstance: {
      updateMany: jest.fn(async (args: any) => {
        casArgs = args;
        return { count: casCount };
      }),
      findUnique: jest.fn(async () => ({
        ...makeInstance(),
        status: 'pending',
        resubmitCount: MAX_RESUBMITS,
      })),
    },
    approvalWorkflowNode: { findUnique: jest.fn(async () => null) },
  };
  const prisma = {
    approvalInstance: { findUnique: jest.fn(async () => makeInstance()) },
    approvalWorkflowNode: { findUnique: jest.fn(async () => null) },
    approvalRecord: { findFirst: jest.fn(async () => null) },
    department: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  const notificationService = { create: jest.fn(), removeByRelated: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const service = new ApprovalService(
    prisma as never,
    notificationService as never,
    eventEmitter as never,
    {} as never, // RedisService
  );
  return { service, tx, getCasArgs: () => casArgs };
}

describe('审批重提上限 · 并发安全（P2-8）', () => {
  it('抢占成功：CAS 条件必须同时约束状态与次数上限', async () => {
    const { service, getCasArgs } = makeService(1);

    await service.resubmit({ instanceId: 1, userId: 7 });

    const where = getCasArgs().where;
    expect(where.id).toBe(1);
    expect(where.status).toEqual({ in: ['rejected', 'cancelled'] });
    expect(where.resubmitCount).toEqual({ lt: MAX_RESUBMITS });
    expect(getCasArgs().data.resubmitCount).toEqual({ increment: 1 });
  });

  it('抢占失败（并发已用尽次数 / 状态已被改写）→ 报错且不产生任何副作用', async () => {
    const { service, tx } = makeService(0);

    await expect(service.resubmit({ instanceId: 1, userId: 7 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // 关键：CAS 未抢到就不能删节点、不能建节点（否则会留下半个审批链）
    expect(tx.approvalRecord.deleteMany).not.toHaveBeenCalled();
    expect(tx.approvalRecord.createMany).not.toHaveBeenCalled();
  });

  it('错误码仍为「重提次数已达上限」（前端据此提示）', async () => {
    const { service } = makeService(0);

    try {
      await service.resubmit({ instanceId: 1, userId: 7 });
      throw new Error('应当抛出');
    } catch (e) {
      const res = (e as BadRequestException).getResponse() as { code?: number };
      expect(res.code).toBe(ERROR_CODES.APPROVAL_RESUBMIT_LIMIT);
    }
  });
});
