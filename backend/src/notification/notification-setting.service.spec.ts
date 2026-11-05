import { NotificationSettingService } from './notification-setting.service';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';

const mockPrisma: any = {
  notificationSetting: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  role: {
    findMany: jest.fn(),
  },
};

describe('NotificationSettingService（通知策略：流程节点开关 + 非流程收件方）', () => {
  let service: NotificationSettingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.notificationSetting.findUnique.mockResolvedValue(null);
    service = new NotificationSettingService(mockPrisma);
  });

  describe('list（读取全部事件的通知设置）', () => {
    it('应返回全部设置，并把两列 Json 反序列化；缺列视为未配置（null）', async () => {
      mockPrisma.notificationSetting.findMany.mockResolvedValue([
        { id: 1, eventType: 'leave_apply', targetRoles: [], targetNodes: ['manager_approve'] },
        { id: 2, eventType: 'late_notify', targetRoles: ['dept_manager'], targetNodes: null },
      ]);

      const result = await service.list();

      expect(result).toEqual([
        { eventType: 'leave_apply', targetRoles: [], targetNodes: ['manager_approve'] },
        { eventType: 'late_notify', targetRoles: ['dept_manager'], targetNodes: null },
      ]);
    });

    it('无任何设置时返回空数组', async () => {
      mockPrisma.notificationSetting.findMany.mockResolvedValue([]);
      await expect(service.list()).resolves.toEqual([]);
    });
  });

  describe('setTargets（按字段增量更新）', () => {
    it('只提交 targetNodes 时不动 targetRoles', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: ['manager_approve'],
      });

      await service.setTargets('leave_apply', { targetNodes: ['manager_approve'] });

      const call = mockPrisma.notificationSetting.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ eventType: 'leave_apply' });
      expect(call.update).toEqual({ targetNodes: ['manager_approve'] });
      expect(call.update.targetRoles).toBeUndefined();
      // 新建行时 targetRoles 必须给值（列非空），用空数组表示「没有额外收件方」
      expect(call.create.targetRoles).toEqual([]);
    });

    it('只提交 targetRoles 时不动 targetNodes', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'late_notify',
        targetRoles: ['dept_manager'],
        targetNodes: null,
      });

      await service.setTargets('late_notify', { targetRoles: ['dept_manager'] });

      const call = mockPrisma.notificationSetting.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ targetRoles: ['dept_manager'] });
      expect(call.update.targetNodes).toBeUndefined();
    });

    it('空数组是合法值（显式关闭），不能被当成未传', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: [],
      });

      await service.setTargets('leave_apply', { targetNodes: [] });

      expect(mockPrisma.notificationSetting.upsert.mock.calls[0][0].update).toEqual({
        targetNodes: [],
      });
    });

    it('传 null 表示恢复默认（流程新增节点时自动继承通知）', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: null,
      });

      await service.setTargets('leave_apply', { targetNodes: null });

      // Prisma 写 JSON 列的 SQL NULL 必须用 DbNull，普通 null 会被当成 JSON null
      expect(mockPrisma.notificationSetting.upsert.mock.calls[0][0].update.targetNodes).toBe(
        Prisma.DbNull,
      );
    });

    it('两个字段都不传时抛 PARAM_INVALID', async () => {
      await expect(service.setTargets('leave_apply', {}))
        .rejects.toMatchObject({ response: { code: ERROR_CODES.PARAM_INVALID } });
      expect(mockPrisma.notificationSetting.upsert).not.toHaveBeenCalled();
    });

    it('传入非数组时抛 PARAM_INVALID', async () => {
      await expect(
        service.setTargets('leave_apply', { targetNodes: 'manager_approve' as unknown as string[] }),
      ).rejects.toMatchObject({ response: { code: ERROR_CODES.PARAM_INVALID } });
      expect(mockPrisma.notificationSetting.upsert).not.toHaveBeenCalled();
    });

    it('事件类型为空时抛 PARAM_INVALID', async () => {
      await expect(service.setTargets('  ', { targetNodes: [] }))
        .rejects.toMatchObject({ response: { code: ERROR_CODES.PARAM_INVALID } });
    });

    it('保存后清掉该事件的策略缓存，下一次 getPolicy 重新读库', async () => {
      mockPrisma.notificationSetting.findUnique.mockResolvedValue({
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: null,
      });
      await service.getPolicy('leave_apply');
      expect(mockPrisma.notificationSetting.findUnique).toHaveBeenCalledTimes(1);

      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: ['manager_approve'],
      });
      await service.setTargets('leave_apply', { targetNodes: ['manager_approve'] });

      mockPrisma.notificationSetting.findUnique.mockResolvedValue({
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: ['manager_approve'],
      });
      const policy = await service.getPolicy('leave_apply');
      expect(mockPrisma.notificationSetting.findUnique).toHaveBeenCalledTimes(2);
      expect(policy.targetNodes).toEqual(['manager_approve']);
    });
  });

  describe('setTargetRoles（兼容旧调用）', () => {
    it('等价于只提交 targetRoles', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'late_notify',
        targetRoles: [],
        targetNodes: null,
      });

      await service.setTargetRoles('late_notify', []);

      expect(mockPrisma.notificationSetting.upsert.mock.calls[0][0].update).toEqual({
        targetRoles: [],
      });
    });
  });

  describe('getPolicy（发送侧读取）', () => {
    it('从未配置过时返回 null 语义，调用方按默认策略发送', async () => {
      const policy = await service.getPolicy('leave_apply');
      expect(policy).toEqual({ targetRoles: null, targetNodes: null });
    });

    it('命中配置时返回数组（空数组代表显式关闭，不能归一成 null）', async () => {
      mockPrisma.notificationSetting.findUnique.mockResolvedValue({
        eventType: 'leave_apply',
        targetRoles: [],
        targetNodes: [],
      });

      await expect(service.getPolicy('leave_apply')).resolves.toEqual({
        targetRoles: [],
        targetNodes: [],
      });
    });

    it('命中缓存时不重复查库', async () => {
      mockPrisma.notificationSetting.findUnique.mockResolvedValue({
        eventType: 'leave_apply',
        targetRoles: ['applicant'],
        targetNodes: ['manager_approve'],
      });

      await service.getPolicy('leave_apply');
      await service.getPolicy('leave_apply');

      expect(mockPrisma.notificationSetting.findUnique).toHaveBeenCalledTimes(1);
    });

    it('读库异常时降级为 null 策略，不把异常抛给审批链路', async () => {
      mockPrisma.notificationSetting.findUnique.mockRejectedValue(new Error('db down'));

      await expect(service.getPolicy('leave_apply')).resolves.toEqual({
        targetRoles: null,
        targetNodes: null,
      });
    });
  });

  describe('listRoles（非流程事件的可选收件方）', () => {
    it('应合并伪角色与数据库角色，并过滤已被伪角色覆盖的角色名', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        { name: '管理员' },
        { name: '部门主管' },
        { name: '申请人' },
        { name: '财务审核' },
      ]);

      const result = await service.listRoles();

      const values = result.map((r) => r.value);
      const labels = result.map((r) => r.label);
      expect(values).toEqual(
        expect.arrayContaining(['applicant', 'dept_manager', 'next_approver', 'task_audience']),
      );
      expect(labels).toContain('业务发起人（本人）');
      expect(labels).toContain('其所属部门主管');
      expect(labels).toContain('审批流下一环节待办人');
      expect(labels).toContain('任务指派受众');
      // 数据库角色中的伪角色覆盖名不应重复出现为系统角色
      expect(labels).not.toContain('部门主管');
      expect(labels).not.toContain('申请人');
      // 真实系统角色保留
      expect(labels).toContain('管理员');
      expect(labels).toContain('财务审核');
    });
  });
});
