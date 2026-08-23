import { AttendanceSettingsService } from './settings.service';

// Mock PrismaService (follows pattern from broadcast.service.spec.ts)
function createMockPrisma() {
  return {
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  } as any;
}

describe('AttendanceSettingsService', () => {
  let service: AttendanceSettingsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AttendanceSettingsService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // getSettings: 返回所有考勤设置（带默认值）
  // ------------------------------------------------------------------
  describe('getSettings - 默认值', () => {
    it('当数据库无存储值时返回全部默认值', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.getSettings();

      expect(result).toEqual({
        lateThreshold: 30,
        earlyThreshold: 30,
        earlyClockInMinutes: 60,
        lateClockOutMinutes: 120,
        absentHours: 4,
        maxAnnualLeaveDays: 10,
        maxSickLeaveDays: 15,
        requireProofForSickLeave: true,
        requireApprovalForOvertime: true,
        minOvertimeHours: 1,
        maxOvertimeHoursPerDay: 4,
        allowMakeup: true,
        makeupDeadlineDays: 3,
        makeupMonthlyLimit: 3,
        makeupDaysLimit: 30,
        requireApprovalForMakeup: true,
        notifyOnLate: true,
        notifyOnEarlyLeave: true,
        notifyOnAbsent: true,
      });

      expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
        where: { group: 'attendance' },
      });
    });
  });

  // ------------------------------------------------------------------
  // getSettings: 返回数据库中已存储的值（合并默认值）
  // ------------------------------------------------------------------
  describe('getSettings - 已存储值', () => {
    it('返回 SystemSetting 表中已存储的值，未覆盖的键保留默认值', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.late_threshold', value: '45', isPublic: false },
        { group: 'attendance', key: 'attendance.absent_hours', value: '6', isPublic: false },
        { group: 'attendance', key: 'attendance.allow_makeup', value: 'false', isPublic: false },
      ]);

      const result = await service.getSettings();

      // 被覆盖的值
      expect(result.lateThreshold).toBe(45);
      expect(result.absentHours).toBe(6);
      expect(result.allowMakeup).toBe(false);
      // 未被覆盖的值保持默认
      expect(result.earlyThreshold).toBe(30);
      expect(result.earlyClockInMinutes).toBe(60);
      expect(result.maxAnnualLeaveDays).toBe(10);
      expect(result.notifyOnLate).toBe(true);
    });

    it('正确解析 boolean 和 number 类型的存储值', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.require_proof_for_sick_leave', value: 'false', isPublic: false },
        { group: 'attendance', key: 'attendance.min_overtime_hours', value: '2', isPublic: false },
        { group: 'attendance', key: 'attendance.max_overtime_hours_per_day', value: '8', isPublic: false },
      ]);

      const result = await service.getSettings();

      expect(result.requireProofForSickLeave).toBe(false);
      expect(result.minOvertimeHours).toBe(2);
      expect(result.maxOvertimeHoursPerDay).toBe(8);
      expect(typeof result.requireProofForSickLeave).toBe('boolean');
      expect(typeof result.minOvertimeHours).toBe('number');
    });
  });

  // ------------------------------------------------------------------
  // getSettings: publicOnly 模式（未来公开端点）
  // ------------------------------------------------------------------
  describe('getSettings - publicOnly', () => {
    it('当 publicOnly=true 时仅返回 isPublic=true 的设置', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.allow_makeup', value: 'false', isPublic: true },
        { group: 'attendance', key: 'attendance.notify_on_late', value: 'false', isPublic: true },
      ]);

      const result = await service.getSettings({ publicOnly: true });

      // 查询条件包含 isPublic: true
      expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
        where: { group: 'attendance', isPublic: true },
      });

      // 公开设置被存储值覆盖
      expect(result.allowMakeup).toBe(false);
      expect(result.notifyOnLate).toBe(false);
      // 其他公开设置保留默认值
      expect(result.notifyOnEarlyLeave).toBe(true);
      expect(result.notifyOnAbsent).toBe(true);
      expect(result.requireProofForSickLeave).toBe(true);
      expect(result.requireApprovalForOvertime).toBe(true);
      expect(result.requireApprovalForMakeup).toBe(true);
      expect(result.makeupDeadlineDays).toBe(3);
      expect(result.makeupMonthlyLimit).toBe(3);
      expect(result.makeupDaysLimit).toBe(30);

      // 非公开设置不包含在结果中
      expect(result.lateThreshold).toBeUndefined();
      expect(result.earlyThreshold).toBeUndefined();
      expect(result.earlyClockInMinutes).toBeUndefined();
      expect(result.lateClockOutMinutes).toBeUndefined();
      expect(result.absentHours).toBeUndefined();
      expect(result.maxAnnualLeaveDays).toBeUndefined();
      expect(result.maxSickLeaveDays).toBeUndefined();
      expect(result.minOvertimeHours).toBeUndefined();
      expect(result.maxOvertimeHoursPerDay).toBeUndefined();
    });

    it('当 publicOnly=true 且无存储值时返回公开设置的默认值', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.getSettings({ publicOnly: true });

      expect(result.allowMakeup).toBe(true);
      expect(result.makeupDeadlineDays).toBe(3);
      expect(result.makeupMonthlyLimit).toBe(3);
      expect(result.makeupDaysLimit).toBe(30);
      expect(result.requireApprovalForMakeup).toBe(true);
      expect(result.notifyOnLate).toBe(true);
      expect(result.notifyOnEarlyLeave).toBe(true);
      expect(result.notifyOnAbsent).toBe(true);
      expect(result.requireProofForSickLeave).toBe(true);
      expect(result.requireApprovalForOvertime).toBe(true);
      // 非公开设置不包含
      expect(result.lateThreshold).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // updateSettings: upsert 每个提供的设置键
  // ------------------------------------------------------------------
  describe('updateSettings - upsert', () => {
    it('将每个提供的设置键 upsert 到 SystemSetting 表', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      prisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateSettings(
        { lateThreshold: 45, absentHours: 6 },
        1, // updatedBy
      );

      // 应为每个提供的键调用 upsert
      expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(2);

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'attendance.late_threshold' },
        update: {
          value: '45',
          updatedBy: 1,
        },
        create: {
          group: 'attendance',
          key: 'attendance.late_threshold',
          value: '45',
          isPublic: false,
          updatedBy: 1,
        },
      });

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'attendance.absent_hours' },
        update: {
          value: '6',
          updatedBy: 1,
        },
        create: {
          group: 'attendance',
          key: 'attendance.absent_hours',
          value: '6',
          isPublic: false,
          updatedBy: 1,
        },
      });
    });

    it('正确将 boolean 值序列化为字符串', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      prisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateSettings(
        { allowMakeup: false, notifyOnLate: true },
        2,
      );

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'attendance.allow_makeup' },
          update: expect.objectContaining({ value: 'false' }),
          create: expect.objectContaining({ value: 'false', isPublic: true }),
        }),
      );
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'attendance.notify_on_late' },
          update: expect.objectContaining({ value: 'true' }),
          create: expect.objectContaining({ value: 'true', isPublic: true }),
        }),
      );
    });

    it('upsert 后返回更新后的完整设置对象', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      // 模拟 upsert 后的查询返回更新后的值
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.late_threshold', value: '45', isPublic: false },
      ]);

      const result = await service.updateSettings({ lateThreshold: 45 }, 1);

      // 被更新的值
      expect(result.lateThreshold).toBe(45);
      // 其他值保持默认
      expect(result.earlyThreshold).toBe(30);
      expect(result.absentHours).toBe(4);
    });

    it('当未提供 updatedBy 时 upsert 仍能正常执行', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      prisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateSettings({ lateThreshold: 50 });

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'attendance.late_threshold' },
        update: {
          value: '50',
          updatedBy: undefined,
        },
        create: {
          group: 'attendance',
          key: 'attendance.late_threshold',
          value: '50',
          isPublic: false,
          updatedBy: undefined,
        },
      });
    });

    it('当传入空对象时不调用 upsert，直接返回当前设置', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.updateSettings({}, 1);

      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
      expect(result.lateThreshold).toBe(30);
    });
  });

  // ------------------------------------------------------------------
  // updateSettings: 权限控制在 controller 层（@RequirePermission('attendance:manage')）
  // 此处验证 service 层正确接收并记录 updatedBy
  // ------------------------------------------------------------------
  describe('updateSettings - updatedBy 记录', () => {
    it('将 JWT 用户 ID 作为 updatedBy 记录到 SystemSetting', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const userId = 42;
      await service.updateSettings({ lateThreshold: 60 }, userId);

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ updatedBy: userId }),
          create: expect.objectContaining({ updatedBy: userId }),
        }),
      );
    });
  });
});
