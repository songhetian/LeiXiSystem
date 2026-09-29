import { VacationTypeService } from './vacation-type.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

function createMockPrisma() {
  return {
    vacationType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    vacationBalance: {
      count: jest.fn(),
    },
    leaveRecord: {
      count: jest.fn(),
    },
  };
}

function buildService(prisma: any) {
  return new VacationTypeService(prisma as any);
}

describe('VacationTypeService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: VacationTypeService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = buildService(prisma);
  });

  describe('list', () => {
    it('should return all vacation types ordered by sortOrder asc', async () => {
      const rows = [{ id: 1, code: 'annual', name: '年假' }];
      prisma.vacationType.findMany.mockResolvedValue(rows);

      const result = await service.list();

      expect(prisma.vacationType.findMany).toHaveBeenCalledWith({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual(rows);
    });
  });

  describe('create', () => {
    it('should create a vacation type with fields', async () => {
      const input = {
        code: 'annual',
        name: '年假',
        baseDays: 5,
        enabled: true,
        sortOrder: 1,
        carryOverMaxDays: 5,
        carryOverRatio: 0.5,
        seniorityRule: [{ minYears: 0, maxYears: 1, days: 5 }],
      };
      prisma.vacationType.create.mockResolvedValue({ id: 1, ...input });

      const result = await service.create(input);

      expect(prisma.vacationType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'annual',
          name: '年假',
          baseDays: expect.anything(),
          seniorityRule: input.seniorityRule,
        }),
      });
      expect(result.id).toBe(1);
    });

    it('should strip unknown fields before create', async () => {
      const input: any = { code: 'sick', name: '病假', hack: 'xx' };
      prisma.vacationType.create.mockResolvedValue({ id: 1, ...input });

      await service.create(input);

      expect(prisma.vacationType.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ hack: 'xx' }),
      });
    });

    it('should persist monthlyDays when creating a monthly leave type', async () => {
      const input = {
        code: 'monthly',
        name: '月假',
        monthlyDays: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5],
      };
      prisma.vacationType.create.mockResolvedValue({ id: 1, ...input });

      await service.create(input);

      expect(prisma.vacationType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          monthlyDays: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5],
        }),
      });
    });

    it('should reject monthlyDays whose length is not 12', async () => {
      const input = { code: 'monthly', name: '月假', monthlyDays: [4, 4, 4] };

      await expect(service.create(input)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.vacationType.create).not.toHaveBeenCalled();
    });

    it('should reject monthlyDays containing negative values', async () => {
      const input = {
        code: 'monthly',
        name: '月假',
        monthlyDays: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, -1],
      };

      await expect(service.create(input)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update existing vacation type', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 5 });
      prisma.vacationType.update.mockResolvedValue({ id: 5, name: '年假', code: 'annual' });

      const result = await service.update(5, { name: '年假', baseDays: 6 });

      expect(prisma.vacationType.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ name: '年假', baseDays: expect.anything() }),
      });
      expect(result.id).toBe(5);
    });

    it('should throw NotFound when updating a missing type', async () => {
      prisma.vacationType.findUnique.mockResolvedValue(null);
      await expect(service.update(99, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should update monthlyDays when provided', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 5 });
      prisma.vacationType.update.mockResolvedValue({ id: 5 });

      await service.update(5, { monthlyDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });

      expect(prisma.vacationType.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({ monthlyDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
      });
    });

    it('should clear monthlyDays to null when explicitly set (switch back to yearly type)', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 5 });
      prisma.vacationType.update.mockResolvedValue({ id: 5 });

      await service.update(5, { monthlyDays: null });

      // 清空即写入数据库 NULL（Prisma.DbNull），使该类型回归非月假
      expect(prisma.vacationType.update.mock.calls[0][0].data.monthlyDays).toBe(Prisma.DbNull);
    });

    it('should not touch monthlyDays when omitted', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 5 });
      prisma.vacationType.update.mockResolvedValue({ id: 5 });

      await service.update(5, { name: '年假' });

      expect(prisma.vacationType.update.mock.calls[0][0].data).not.toHaveProperty('monthlyDays');
    });
  });

  describe('remove', () => {
    it('should delete a vacation type when not referenced by balances', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 7 });
      prisma.vacationBalance.count.mockResolvedValue(0);
      prisma.leaveRecord.count.mockResolvedValue(0);
      prisma.vacationType.delete.mockResolvedValue({ id: 7 });

      await service.remove(7);

      expect(prisma.vacationBalance.count).toHaveBeenCalledWith({
        where: { vacationTypeId: 7 },
      });
      expect(prisma.vacationType.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    });

    /**
     * LeaveRecord.vacationTypeId 外键为 Restrict（无级联），若只校验余额就放行删除，
     * 数据库会抛 P2003 → 500，而不是可读的 409。
     */
    it('should throw Conflict when type has leave records', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 7 });
      prisma.vacationBalance.count.mockResolvedValue(0);
      prisma.leaveRecord.count.mockResolvedValue(2);

      await expect(service.remove(7)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.vacationType.delete).not.toHaveBeenCalled();
    });

    it('should throw Conflict when type has balance records', async () => {
      prisma.vacationType.findUnique.mockResolvedValue({ id: 7 });
      prisma.vacationBalance.count.mockResolvedValue(3);

      await expect(service.remove(7)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.vacationType.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFound when deleting a missing type', async () => {
      prisma.vacationType.findUnique.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('validateSeniorityRule', () => {
    it('should accept an empty/undefined rule', () => {
      expect(() => service.validateSeniorityRule(undefined)).not.toThrow();
    });

    it('should reject a rule that is not an array', () => {
      expect(() => service.validateSeniorityRule({ minYears: 0 })).toThrow(BadRequestException);
    });

    it('should reject a rule lacking days', () => {
      expect(() =>
        service.validateSeniorityRule([{ minYears: 0, maxYears: 1 }]),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateMonthlyDays', () => {
    it('should accept undefined/null (non-monthly leave type)', () => {
      expect(() => service.validateMonthlyDays(undefined)).not.toThrow();
      expect(() => service.validateMonthlyDays(null)).not.toThrow();
    });

    it('should accept a 12-length numeric array', () => {
      expect(() => service.validateMonthlyDays(new Array(12).fill(1))).not.toThrow();
    });

    it('should reject a non-array value', () => {
      expect(() => service.validateMonthlyDays('1,2,3')).toThrow(BadRequestException);
    });

    it('should reject an array whose length is not 12', () => {
      expect(() => service.validateMonthlyDays([1, 2, 3])).toThrow(BadRequestException);
    });

    it('should reject non-numeric or negative items', () => {
      expect(() => service.validateMonthlyDays([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 'x'])).toThrow(
        BadRequestException,
      );
      expect(() => service.validateMonthlyDays([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, -1])).toThrow(
        BadRequestException,
      );
    });
  });
});