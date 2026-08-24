import { ReimbursementService } from './reimbursement.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

function createMockPrisma() {
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    userDepartment: {
      findMany: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    reimbursementType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reimbursement: {
      count: jest.fn(),
    },
  };
  return mockPrisma;
}

describe('ReimbursementService - 报销类型配置', () => {
  let service: ReimbursementService;
  let prisma: any;
  const dataScope: any = { visibleScope: jest.fn() };
  const approvalClient: any = {};

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReimbursementService(prisma, dataScope, approvalClient);
    jest.clearAllMocks();
  });

  describe('listAllTypes - 报销类型列表（含停用）', () => {
    it('返回全部报销类型（管理用）', async () => {
      const rows = [
        { id: 1, code: 'meal', name: '餐费', status: 'active' },
        { id: 2, code: 'travel', name: '差旅', status: 'inactive' },
      ];
      prisma.reimbursementType.findMany.mockResolvedValue(rows);

      const result = await service.listAllTypes();

      expect(prisma.reimbursementType.findMany).toHaveBeenCalledWith({
        orderBy: { id: 'asc' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('createType - 新建报销类型', () => {
    it('编码已存在时抛出冲突异常', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'meal' });

      await expect(
        service.createType({ code: 'meal', name: '餐费' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.reimbursementType.create).not.toHaveBeenCalled();
    });

    it('创建成功且默认状态为 active', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue(null);
      prisma.reimbursementType.create.mockResolvedValue({
        id: 3,
        code: 'transport',
        name: '交通',
        status: 'active',
      });

      const result = await service.createType({ code: 'transport', name: '交通' });

      expect(prisma.reimbursementType.create).toHaveBeenCalledWith({
        data: {
          code: 'transport',
          name: '交通',
          description: undefined,
          status: 'active',
        },
      });
      expect(result.status).toBe('active');
    });
  });

  describe('updateType - 更新报销类型', () => {
    it('类型不存在时抛出未找到异常', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue(null);

      await expect(
        service.updateType(99, { name: '改名' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('更新名称与状态成功', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'meal' });
      prisma.reimbursementType.update.mockResolvedValue({
        id: 1,
        code: 'meal',
        name: '工作餐',
        status: 'inactive',
      });

      const result = await service.updateType(1, { name: '工作餐', status: 'inactive' });

      expect(prisma.reimbursementType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: '工作餐', status: 'inactive' },
      });
      expect(result.name).toBe('工作餐');
    });
  });

  describe('removeType - 删除报销类型', () => {
    it('类型不存在时抛出未找到异常', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue(null);

      await expect(service.removeType(99)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.reimbursementType.delete).not.toHaveBeenCalled();
    });

    it('类型已被报销单占用时禁止删除', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'meal' });
      prisma.reimbursement.count.mockResolvedValue(3);

      await expect(service.removeType(1)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.reimbursementType.delete).not.toHaveBeenCalled();
    });

    it('类型未被引用时删除成功', async () => {
      prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'meal' });
      prisma.reimbursement.count.mockResolvedValue(0);
      prisma.reimbursementType.delete.mockResolvedValue({ id: 1 });

      const result = await service.removeType(1);

      expect(prisma.reimbursement.count).toHaveBeenCalledWith({
        where: { typeId: 1 },
      });
      expect(prisma.reimbursementType.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.success).toBe(true);
    });
  });
});