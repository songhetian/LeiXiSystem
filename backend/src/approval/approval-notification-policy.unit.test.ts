import { ApprovalService } from './approval.service';

/**
 * 通知策略接入（审批侧）：
 * 「通知设置」里的节点开关/终态开关必须真的改变发送行为，
 * 否则配置页仍是死配置（本次改造前的状态）。
 */
const mockPrisma: any = {
  approvalWorkflow: { findUnique: jest.fn() },
  approvalInstance: { findUnique: jest.fn() },
};

const notificationClient: any = { create: jest.fn(), createMany: jest.fn() };

function buildService(policy?: { getPolicy: jest.Mock }) {
  return new ApprovalService(
    mockPrisma,
    notificationClient,
    {} as any,
    {} as any,
    undefined,
    policy as any,
  );
}

describe('ApprovalService · 通知策略（NOTIFICATION_POLICY）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ code: 'leave' });
    mockPrisma.approvalInstance.findUnique.mockResolvedValue({ workflowId: 1 });
  });

  describe('shouldNotifyNode（节点到达是否通知处理人）', () => {
    it('没有注入策略（测试/降级场景）时默认通知', async () => {
      const svc = buildService(undefined);
      await expect((svc as any).shouldNotifyNode(1, 'manager_approve')).resolves.toBe(true);
    });

    it('事件未配置（targetNodes 为 null）时默认通知', async () => {
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: null }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyNode(1, 'manager_approve')).resolves.toBe(true);
    });

    it('节点在勾选列表内时通知', async () => {
      const policy = {
        getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: ['manager_approve'] }),
      };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyNode(1, 'manager_approve')).resolves.toBe(true);
    });

    it('节点不在勾选列表内时跳过（只通知指定节点）', async () => {
      const policy = {
        getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: ['manager_approve'] }),
      };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyNode(1, 'finance_approve')).resolves.toBe(false);
    });

    it('空数组代表显式全部关闭', async () => {
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: [] }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyNode(1, 'manager_approve')).resolves.toBe(false);
    });

    it('流程未登记通知事件时不受配置影响（默认通知）', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ code: 'onboarding' });
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: [] }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyNode(1, 'any_node')).resolves.toBe(true);
      expect(policy.getPolicy).not.toHaveBeenCalled();
    });

    it('按 workflow 编码读取对应事件，而不是写死 leave', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ code: 'punch_makeup' });
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: ['hr'] }) };
      const svc = buildService(policy);
      await (svc as any).shouldNotifyNode(9, 'hr');
      expect(policy.getPolicy).toHaveBeenCalledWith('makeup_apply');
    });
  });

  describe('shouldNotifyApplicant（终态是否通知申请人）', () => {
    it('未配置时默认通知', async () => {
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: null, targetNodes: null }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyApplicant(5, 'approved')).resolves.toBe(true);
    });

    it('显式包含 applicant 时通知', async () => {
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: ['applicant'], targetNodes: null }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyApplicant(5, 'rejected')).resolves.toBe(true);
      expect(policy.getPolicy).toHaveBeenCalledWith('leave_rejection');
    });

    it('空数组（关闭）时不通知', async () => {
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: [], targetNodes: null }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyApplicant(5, 'approved')).resolves.toBe(false);
    });

    it('流程没有登记的驳回事件时保持默认通知（加班/补卡无 rejection 事件）', async () => {
      mockPrisma.approvalWorkflow.findUnique.mockResolvedValue({ code: 'overtime' });
      const policy = { getPolicy: jest.fn().mockResolvedValue({ targetRoles: [], targetNodes: null }) };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyApplicant(5, 'rejected')).resolves.toBe(true);
      expect(policy.getPolicy).not.toHaveBeenCalled();
    });

    it('实例不存在时不因查不到流程而吞掉通知', async () => {
      mockPrisma.approvalInstance.findUnique.mockResolvedValue(null);
      const policy = { getPolicy: jest.fn() };
      const svc = buildService(policy);
      await expect((svc as any).shouldNotifyApplicant(404, 'approved')).resolves.toBe(true);
    });
  });
});
