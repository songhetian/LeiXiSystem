import { ApprovalReminderService } from './approval-reminder.service';

const mockPrisma: any = {
  approvalInstance: {
    findMany: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
  },
  approvalGroupMember: {
    findMany: jest.fn(),
  },
  notification: {
    count: jest.fn(),
  },
};

const mockNotificationService: any = {
  create: jest.fn(),
  createMany: jest.fn(),
};

const mockSettingsService: any = {
  get: jest.fn(),
};

describe('ApprovalReminderService', () => {
  let service: ApprovalReminderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApprovalReminderService(
      mockPrisma,
      mockNotificationService,
      mockSettingsService,
    );
  });

  describe('checkOverdueAndNotify', () => {
    it('没有超时审批时不发送提醒', async () => {
      mockSettingsService.get.mockRejectedValue(new Error('not found'));
      mockPrisma.approvalInstance.findMany.mockResolvedValue([]);

      const result = await service.checkOverdueAndNotify();

      expect(result.remindedCount).toBe(0);
      expect(result.instanceCount).toBe(0);
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('应扫描超时审批并给角色节点的审批人发送提醒', async () => {
      const now = new Date();
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

      mockSettingsService.get.mockRejectedValue(new Error('not found'));
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        {
          id: 1,
          title: '报销申请-差旅费',
          status: 'pending',
          currentNodeKey: 'node1',
          createdAt: fourDaysAgo,
          records: [
            {
              id: 1,
              nodeKey: 'node1',
              status: 'pending',
              node: { id: 1, type: 'role', roleCode: 'manager' },
            },
          ],
        },
      ]);
      mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 101 }, { userId: 102 }]);
      mockPrisma.notification.count.mockResolvedValue(0);
      mockNotificationService.create.mockResolvedValue({ id: 1 });

      const result = await service.checkOverdueAndNotify();

      expect(result.remindedCount).toBe(2);
      expect(result.instanceCount).toBe(2);
      expect(mockNotificationService.create).toHaveBeenCalledTimes(2);

      const callArgs = mockNotificationService.create.mock.calls[0][0];
      expect(callArgs.type).toBe('approval_overdue');
      expect(callArgs.title).toContain('1 条审批已超时');
      expect(callArgs.content).toContain('报销申请-差旅费');
    });

    it('应扫描超时审批并给审批组节点的成员发送提醒', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      mockSettingsService.get.mockRejectedValue(new Error('not found'));
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        {
          id: 2,
          title: '请假申请-年假',
          status: 'pending',
          currentNodeKey: 'node2',
          createdAt: fiveDaysAgo,
          records: [
            {
              id: 2,
              nodeKey: 'node2',
              status: 'pending',
              node: { id: 2, type: 'group', approvalGroupId: 1 },
            },
          ],
        },
      ]);
      mockPrisma.approvalGroupMember.findMany.mockResolvedValue([{ userId: 201 }]);
      mockPrisma.notification.count.mockResolvedValue(0);
      mockNotificationService.create.mockResolvedValue({ id: 2 });

      const result = await service.checkOverdueAndNotify();

      expect(result.remindedCount).toBe(1);
      expect(result.instanceCount).toBe(1);
      expect(mockPrisma.approvalGroupMember.findMany).toHaveBeenCalledWith({
        where: { groupId: 1 },
        select: { userId: true },
      });
    });

    it('同一天内同一用户只提醒一次', async () => {
      const now = new Date();
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

      mockSettingsService.get.mockRejectedValue(new Error('not found'));
      mockPrisma.approvalInstance.findMany.mockResolvedValue([
        {
          id: 1,
          title: '报销申请',
          status: 'pending',
          currentNodeKey: 'node1',
          createdAt: fourDaysAgo,
          records: [
            {
              id: 1,
              nodeKey: 'node1',
              status: 'pending',
              node: { id: 1, type: 'role', roleCode: 'hr' },
            },
          ],
        },
        {
          id: 2,
          title: '请假申请',
          status: 'pending',
          currentNodeKey: 'node1',
          createdAt: fourDaysAgo,
          records: [
            {
              id: 2,
              nodeKey: 'node1',
              status: 'pending',
              node: { id: 1, type: 'role', roleCode: 'hr' },
            },
          ],
        },
      ]);
      mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 301 }]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.checkOverdueAndNotify();

      expect(result.remindedCount).toBe(0);
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('应从系统设置读取超期天数', async () => {
      mockSettingsService.get.mockResolvedValue({ value: '5' });
      mockPrisma.approvalInstance.findMany.mockResolvedValue([]);

      await service.checkOverdueAndNotify();

      expect(mockSettingsService.get).toHaveBeenCalledWith('approval.overdue_days');
      const findManyArgs = mockPrisma.approvalInstance.findMany.mock.calls[0][0];
      const expectedDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      expect(findManyArgs.where.createdAt.lte.getTime()).toBeCloseTo(expectedDate.getTime(), -2);
    });

    it('超期天数配置无效时使用默认值 3 天', async () => {
      mockSettingsService.get.mockResolvedValue({ value: 'invalid' });
      mockPrisma.approvalInstance.findMany.mockResolvedValue([]);

      await service.checkOverdueAndNotify();

      const findManyArgs = mockPrisma.approvalInstance.findMany.mock.calls[0][0];
      const expectedDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(findManyArgs.where.createdAt.lte.getTime()).toBeCloseTo(expectedDate.getTime(), -2);
    });

    it('多条超时时内容最多显示 5 条', async () => {
      const now = new Date();
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

      const instances = [];
      for (let i = 1; i <= 7; i++) {
        instances.push({
          id: i,
          title: `审批申请-${i}`,
          status: 'pending',
          currentNodeKey: 'node1',
          createdAt: fourDaysAgo,
          records: [
            {
              id: i,
              nodeKey: 'node1',
              status: 'pending',
              node: { id: 1, type: 'role', roleCode: 'admin' },
            },
          ],
        });
      }

      mockSettingsService.get.mockRejectedValue(new Error('not found'));
      mockPrisma.approvalInstance.findMany.mockResolvedValue(instances);
      mockPrisma.userRole.findMany.mockResolvedValue([{ userId: 401 }]);
      mockPrisma.notification.count.mockResolvedValue(0);
      mockNotificationService.create.mockResolvedValue({ id: 1 });

      const result = await service.checkOverdueAndNotify();

      expect(result.remindedCount).toBe(1);
      expect(result.instanceCount).toBe(7);

      const callArgs = mockNotificationService.create.mock.calls[0][0];
      expect(callArgs.title).toContain('7 条审批已超时');
      expect(callArgs.content).toContain('...等 7 条审批');
    });
  });
});
