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
  // 当前注册表仅保留「真正被业务消费」的配置项：
  //   - lateThreshold        (attendance.late_threshold,   private)
  //   - earlyThreshold       (attendance.early_threshold,  private)
  //   - earlyClockInMinutes  (attendance.early_clock_in_minutes, private)
  //   - makeupDaysLimit      (attendance.makeup_days_limit, public)
  //   - makeupMonthlyLimit   (attendance.makeup_monthly_limit, public)
  // 其余 13 个预留项（补卡开关/通知/加班/年假病假等）无任何业务代码消费，
  // 已于清理时从注册表移除。
  // ------------------------------------------------------------------

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
        makeupMonthlyLimit: 3,
        makeupDaysLimit: 30,
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
        { group: 'attendance', key: 'attendance.makeup_days_limit', value: '15', isPublic: true },
      ]);

      const result = await service.getSettings();

      // 被覆盖的值
      expect(result.lateThreshold).toBe(45);
      expect(result.makeupDaysLimit).toBe(15);
      // 未被覆盖的值保持默认
      expect(result.earlyThreshold).toBe(30);
      expect(result.earlyClockInMinutes).toBe(60);
      expect(result.makeupMonthlyLimit).toBe(3);
    });

    it('正确解析 number 类型的存储值', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.early_clock_in_minutes', value: '90', isPublic: false },
        { group: 'attendance', key: 'attendance.makeup_monthly_limit', value: '5', isPublic: true },
      ]);

      const result = await service.getSettings();

      expect(result.earlyClockInMinutes).toBe(90);
      expect(result.makeupMonthlyLimit).toBe(5);
      expect(typeof result.earlyClockInMinutes).toBe('number');
      expect(typeof result.makeupMonthlyLimit).toBe('number');
    });
  });

  // ------------------------------------------------------------------
  // getSettings: publicOnly 模式（公开端点，如补卡服务）
  // ------------------------------------------------------------------
  describe('getSettings - publicOnly', () => {
    it('当 publicOnly=true 时仅返回 isPublic=true 的设置', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.makeup_days_limit', value: '20', isPublic: true },
      ]);

      const result = await service.getSettings({ publicOnly: true });

      // 查询条件包含 isPublic: true
      expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
        where: { group: 'attendance', isPublic: true },
      });

      // 公开设置被存储值覆盖
      expect(result.makeupDaysLimit).toBe(20);
      // 其他公开设置保留默认值
      expect(result.makeupMonthlyLimit).toBe(3);

      // 非公开设置不包含在结果中
      expect(result.lateThreshold).toBeUndefined();
      expect(result.earlyThreshold).toBeUndefined();
      expect(result.earlyClockInMinutes).toBeUndefined();
    });

    it('当 publicOnly=true 且无存储值时返回公开设置的默认值', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.getSettings({ publicOnly: true });

      expect(result.makeupDaysLimit).toBe(30);
      expect(result.makeupMonthlyLimit).toBe(3);
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
        { lateThreshold: 45, makeupDaysLimit: 15 },
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
        where: { key: 'attendance.makeup_days_limit' },
        update: {
          value: '15',
          updatedBy: 1,
        },
        create: {
          group: 'attendance',
          key: 'attendance.makeup_days_limit',
          value: '15',
          isPublic: true,
          updatedBy: 1,
        },
      });
    });

    it('将 number 值正确序列化为字符串存储', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      prisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateSettings(
        { makeupMonthlyLimit: 5, makeupDaysLimit: 20 },
        2,
      );

      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'attendance.makeup_monthly_limit' },
          update: expect.objectContaining({ value: '5' }),
          create: expect.objectContaining({ value: '5', isPublic: true }),
        }),
      );
      expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'attendance.makeup_days_limit' },
          update: expect.objectContaining({ value: '20' }),
          create: expect.objectContaining({ value: '20', isPublic: true }),
        }),
      );
    });

    it('upsert 后返回更新后的完整设置对象', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      // 模拟 upsert 后的查询返回更新后的值
      prisma.systemSetting.findMany.mockResolvedValue([
        { group: 'attendance', key: 'attendance.makeup_days_limit', value: '20', isPublic: true },
      ]);

      const result = await service.updateSettings({ makeupDaysLimit: 20 }, 1);

      // 被更新的值
      expect(result.makeupDaysLimit).toBe(20);
      // 其他值保持默认
      expect(result.earlyThreshold).toBe(30);
      expect(result.makeupMonthlyLimit).toBe(3);
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

    it('忽略未注册（未知）的键，不触发 upsert', async () => {
      prisma.systemSetting.upsert.mockResolvedValue({});
      prisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateSettings(
        { absentHours: 6, allowMakeup: false } as any,
        1,
      );

      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
    });
  });
});