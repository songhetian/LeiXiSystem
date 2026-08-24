import { NotificationSettingService } from './notification-setting.service';
import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';

const mockPrisma: any = {
  notificationSetting: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  role: {
    findMany: jest.fn(),
  },
};

describe('NotificationSettingService（通知推送目标角色配置，对齐参考 NotificationSettings）', () => {
  let service: NotificationSettingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationSettingService(mockPrisma);
  });

  describe('list（读取全部事件的通知设置）', () => {
    it('应返回全部设置，并将 Json targetRoles 反序列化为字符串数组', async () => {
      mockPrisma.notificationSetting.findMany.mockResolvedValue([
        { id: 1, eventType: 'leave_apply', targetRoles: ['申请人', '部门主管'] },
        { id: 2, eventType: 'late_notify', targetRoles: ['部门主管'] },
      ]);

      const result = await service.list();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ eventType: 'leave_apply', targetRoles: ['申请人', '部门主管'] });
      expect(result[1].eventType).toBe('late_notify');
    });

    it('无任何设置时返回空数组', async () => {
      mockPrisma.notificationSetting.findMany.mockResolvedValue([]);
      await expect(service.list()).resolves.toEqual([]);
    });
  });

  describe('setTargetRoles（更新/新建某事件的目标角色）', () => {
    it('事件不存在时 upsert 创建', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'leave_apply',
        targetRoles: ['申请人', '部门主管'],
      });

      await service.setTargetRoles('leave_apply', ['申请人', '部门主管']);

      const call = mockPrisma.notificationSetting.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ eventType: 'leave_apply' });
      expect(call.update.targetRoles).toEqual(['申请人', '部门主管']);
      expect(call.create.eventType).toBe('leave_apply');
      expect(call.create.targetRoles).toEqual(['申请人', '部门主管']);
    });

    it('清除目标角色时保存空数组', async () => {
      mockPrisma.notificationSetting.upsert.mockResolvedValue({
        id: 1,
        eventType: 'late_notify',
        targetRoles: [],
      });

      await service.setTargetRoles('late_notify', []);
      const call = mockPrisma.notificationSetting.upsert.mock.calls[0][0];
      expect(call.create.targetRoles).toEqual([]);
    });

    it('传入非数组的目标角色时抛 PARAM_INVALID', async () => {
      await expect(service.setTargetRoles('leave_apply', 'someone' as unknown as string[]))
        .rejects.toMatchObject({ response: { code: ERROR_CODES.PARAM_INVALID } });
      expect(mockPrisma.notificationSetting.upsert).not.toHaveBeenCalled();
    });
  });

  describe('listRoles（可选的推送目标 + 系统角色）', () => {
    it('应合并伪角色与数据库角色，并过滤已被伪角色覆盖的角色名', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        { name: '管理员' },
        { name: '部门主管' },
        { name: '申请人' },
        { name: '财务审核' },
      ]);

      const result = await service.listRoles();

      const labels = result.map((r) => r.label);
      expect(labels).toContain('业务发起人 (本人)');
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