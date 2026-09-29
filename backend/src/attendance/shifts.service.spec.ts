import { ShiftsService } from './shifts.service';
import { UnprocessableEntityException, NotFoundException, ConflictException } from '@nestjs/common';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    shift: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    schedule: {
      count: jest.fn(),
    },
  } as any;
}

describe('ShiftsService', () => {
  let service: ShiftsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ShiftsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // create — passes all new fields to prisma
  // ----------------------------------------------------------------
  it('create passes new fields (restDuration, lateThreshold, earlyThreshold, color, departmentId, description, isActive, useGlobalThreshold) to prisma', async () => {
    const dto = {
      name: '早班',
      startTime: '08:00',
      endTime: '17:00',
      isNextDay: false,
      restDuration: 60,
      lateThreshold: 15,
      earlyThreshold: 15,
      color: '#3B82F6',
      departmentId: null,
      description: '标准早班',
      isActive: true,
      useGlobalThreshold: true,
    };
    prisma.shift.create.mockResolvedValue({ id: 1, ...dto });

    const result = await service.create(dto);

    expect(prisma.shift.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toEqual({ id: 1, ...dto });
  });

  // ----------------------------------------------------------------
  // create — defaults useGlobalThreshold to true when omitted
  // ----------------------------------------------------------------
  it('create defaults useGlobalThreshold to true when not provided', async () => {
    const dto = {
      name: '中班',
      startTime: '14:00',
      endTime: '22:00',
      isNextDay: false,
    };
    prisma.shift.create.mockResolvedValue({ id: 2, ...dto, useGlobalThreshold: true, isActive: true });

    await service.create(dto);

    expect(prisma.shift.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ useGlobalThreshold: true, isActive: true }),
    });
  });

  // ----------------------------------------------------------------
  // create — defaults isActive to true when omitted
  // ----------------------------------------------------------------
  it('create defaults isActive to true when not provided', async () => {
    const dto = {
      name: '晚班',
      startTime: '22:00',
      endTime: '06:00',
      isNextDay: true,
    };
    prisma.shift.create.mockResolvedValue({ id: 3, ...dto, isActive: true });

    await service.create(dto);

    expect(prisma.shift.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isActive: true }),
    });
  });

  // ----------------------------------------------------------------
  // create — rejects non-overnight shift where endTime <= startTime
  // ----------------------------------------------------------------
  it('create rejects non-overnight shift where endTime <= startTime', async () => {
    await expect(
      service.create({ name: '坏班次', startTime: '09:00', endTime: '09:00', isNextDay: false }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ----------------------------------------------------------------
  // create — overnight shift with endTime <= startTime is valid
  // ----------------------------------------------------------------
  it('create allows endTime <= startTime when isNextDay is true', async () => {
    const dto = { name: '夜班', startTime: '22:00', endTime: '06:00', isNextDay: true };
    prisma.shift.create.mockResolvedValue({ id: 4, ...dto });

    const result = await service.create(dto);

    expect(result).toBeDefined();
    expect(prisma.shift.create).toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // create — handles P2002 (name conflict) → ConflictException
  // ----------------------------------------------------------------
  it('create throws ConflictException on duplicate name', async () => {
    prisma.shift.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({ name: '早班', startTime: '08:00', endTime: '17:00', isNextDay: false }),
    ).rejects.toThrow(ConflictException);
  });

  // ----------------------------------------------------------------
  // list — includes department relation
  // ----------------------------------------------------------------
  it('list includes department relation in query', async () => {
    prisma.shift.findMany.mockResolvedValue([{ id: 1, name: '早班' }]);

    const result = await service.list();

    expect(prisma.shift.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      include: { department: { select: { id: true, name: true } } },
    });
    expect(result.list).toHaveLength(1);
  });

  // ----------------------------------------------------------------
  // update — passes new fields to prisma
  // ----------------------------------------------------------------
  it('update passes new fields (restDuration, color, description, isActive, useGlobalThreshold) to prisma', async () => {
    prisma.shift.findUnique.mockResolvedValue({
      id: 1, name: '早班', startTime: '08:00', endTime: '17:00', isNextDay: false,
    });
    prisma.shift.update.mockResolvedValue({ id: 1 });

    const dto = {
      restDuration: 90,
      lateThreshold: 10,
      earlyThreshold: 10,
      color: '#10B981',
      description: '更新后的描述',
      isActive: false,
      useGlobalThreshold: false,
    };

    await service.update(1, dto);

    expect(prisma.shift.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        restDuration: 90,
        lateThreshold: 10,
        earlyThreshold: 10,
        color: '#10B981',
        description: '更新后的描述',
        isActive: false,
        useGlobalThreshold: false,
      }),
    });
  });

  // ----------------------------------------------------------------
  // update — throws NotFoundException when shift not found
  // ----------------------------------------------------------------
  it('update throws NotFoundException when shift not found', async () => {
    prisma.shift.findUnique.mockResolvedValue(null);

    await expect(
      service.update(999, { name: '不存在' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ----------------------------------------------------------------
  // update — validates time consistency with existing values
  // ----------------------------------------------------------------
  it('update validates time consistency merging with existing shift values', async () => {
    prisma.shift.findUnique.mockResolvedValue({
      id: 1, name: '早班', startTime: '08:00', endTime: '17:00', isNextDay: false,
    });

    // Only updating startTime to 18:00 → endTime(17:00) < startTime(18:00) and not overnight
    await expect(
      service.update(1, { startTime: '18:00' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ----------------------------------------------------------------
  // remove — throws NotFoundException when shift not found
  // ----------------------------------------------------------------
  it('remove throws NotFoundException when shift not found', async () => {
    prisma.shift.findUnique.mockResolvedValue(null);

    await expect(service.remove(999)).rejects.toThrow(NotFoundException);
  });

  // ----------------------------------------------------------------
  // remove — blocks deletion when shift is used by schedules
  // ----------------------------------------------------------------
  it('remove blocks deletion when shift is in use by schedules', async () => {
    prisma.shift.findUnique.mockResolvedValue({ id: 1, name: '早班' });
    prisma.schedule.count.mockResolvedValue(3);

    await expect(service.remove(1)).rejects.toThrow();
    expect(prisma.shift.delete).not.toHaveBeenCalled();
  });
});

// 捕获异常 payload：全局过滤器会用 ERROR_MESSAGES[code] 覆盖抛出 message
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

describe('ShiftsService - 2001 仅用于「时间冲突/名称重复」，其余语义须有专属码', () => {
  let service: ShiftsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ShiftsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  it('班次不存在：不得复用 2001，中央文案为「班次不存在」', async () => {
    prisma.shift.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.update(999, { name: '不存在' }));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('班次不存在');
  });

  it('班次被排班使用不可删除：不得复用 2001，中央文案为「该班次已被排班使用，无法删除」', async () => {
    prisma.shift.findUnique.mockResolvedValue({ id: 1, name: '早班' });
    prisma.schedule.count.mockResolvedValue(2);

    const payload = await catchPayload(() => service.remove(1));

    expect(payload.code).not.toBe(2001);
    expect(messageOf(payload.code)).toBe('该班次已被排班使用，无法删除');
  });

  it('时间冲突仍使用 2001（回归保护）', async () => {
    const payload = await catchPayload(() =>
      service.create({ name: '坏班次', startTime: '09:00', endTime: '09:00', isNextDay: false }),
    );

    expect(payload.code).toBe(2001);
    expect(messageOf(payload.code)).toBe('班次时间冲突或名称重复');
  });
});
