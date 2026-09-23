import { ReimbursementService } from './reimbursement.service';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

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
    expenseType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    reimbursement: {
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

    it('未传编码时自动生成（前缀 ET + 时间戳 + 随机），避免手填英文编码', async () => {
      prisma.reimbursementType.create.mockResolvedValue({ id: 4, code: 'ET', name: '设备' });
      await service.createType({ name: '设备' });
      const data = prisma.reimbursementType.create.mock.calls[0][0].data;
      expect(data.code).toMatch(/^ET\d{17}$/);
      expect(data.name).toBe('设备');
    });

    it('自动生成时不做手动编码的查重（避免按空码查询）', async () => {
      prisma.reimbursementType.create.mockResolvedValue({ id: 5, code: 'ET20260101' });
      await service.createType({ name: '测试' });
      expect(prisma.reimbursementType.findUnique).not.toHaveBeenCalled();
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

  describe('create - 报销单号自动生成（对齐老项目 BX + 日期时间 + 随机）', () => {
    const baseParams = {
      userId: 1,
      typeCode: 'meal',
      title: '聚餐报销',
      totalAmount: 100,
      items: [{ name: '餐费', amount: 100 }],
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
      prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'meal' });
      prisma.reimbursement.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 10, ...data }));
    });

    it('创建报销时自动生成 BX 前缀单号并写入', async () => {
      await service.create(baseParams);
      const call = prisma.reimbursement.create.mock.calls[0][0].data;
      expect(call.reimbursementNo).toMatch(/^BX\d{17}$/); // BX + 14位日期时间 + 3位随机
    });

    it('生成的单号在不同调用之间不重复', async () => {
      await service.create(baseParams);
      await service.create(baseParams);
      const no1 = prisma.reimbursement.create.mock.calls[0][0].data.reimbursementNo;
      const no2 = prisma.reimbursement.create.mock.calls[1][0].data.reimbursementNo;
      expect(no1).not.toBe(no2);
    });

    it('单号字段命名与数据库列 employeeNo 一致 -> reimbursementNo', async () => {
      await service.create(baseParams);
      const data = prisma.reimbursement.create.mock.calls[0][0].data;
      expect(data).toHaveProperty('reimbursementNo');
    });

    it('并发插入唯一冲突（P2002 on reimbursementNo）时自动重新生成并重试', async () => {
      prisma.reimbursement.create
        .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['reimbursementNo'] } })
        .mockImplementation(({ data }: any) => Promise.resolve({ id: 10, ...data }));

      await service.create(baseParams);

      expect(prisma.reimbursement.create).toHaveBeenCalledTimes(2);
      const no1 = prisma.reimbursement.create.mock.calls[0][0].data.reimbursementNo;
      const no2 = prisma.reimbursement.create.mock.calls[1][0].data.reimbursementNo;
      expect(no1).toMatch(/^BX\d{17}$/);
      expect(no2).toMatch(/^BX\d{17}$/);
      expect(no1).not.toBe(no2);
    });

    it('明细可带费用类型/产生日期/备注/发票附件（对齐老项目 item 结构）', async () => {
      await service.create({
        ...baseParams,
        items: [
          {
            itemType: '市内交通费',
            amount: 100,
            expenseDate: '2026-08-01',
            description: '打车去客户处',
            attachmentUrl: '/upload/invoice1.png',
          },
        ],
      });
      const item = prisma.reimbursement.create.mock.calls[0][0].data.items.create[0];
      expect(item.itemType).toBe('市内交通费');
      expect(item.expenseDate).toBeInstanceOf(Date);
      expect(item.description).toBe('打车去客户处');
      expect(item.attachmentUrl).toBe('/upload/invoice1.png');
      expect(item.name).toBe('市内交通费');
    });

    it('单据可携带附件，等价写入 attachments（对齐老项目 reimbursement_attachments）', async () => {
      await service.create({
        ...baseParams,
        remark: '补充说明',
        attachments: [{ fileName: '发票汇总.pdf', fileUrl: '/upload/receipt.pdf' }],
      });
      const data = prisma.reimbursement.create.mock.calls[0][0].data;
      expect(data.description).toBe('补充说明');
      expect(data.attachments.create).toEqual([
        { fileName: '发票汇总.pdf', fileUrl: '/upload/receipt.pdf' },
      ]);
    });

    it('支持存为草稿（status=draft），默认提交为 pending', async () => {
      await service.create({ ...baseParams, status: 'draft' });
      expect(prisma.reimbursement.create.mock.calls[0][0].data.status).toBe('draft');

      await service.create(baseParams);
      expect(prisma.reimbursement.create.mock.calls[1][0].data.status).toBe('pending');
    });
  });

  describe('create - 服务端校验（重算金额 + 空明细）', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
      prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'meal' });
      prisma.reimbursement.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 10, ...data }));
    });

    it('空明细（items=[]）时拒绝创建，防止空单入库', async () => {
      await expect(
        service.create({
          userId: 1,
          typeCode: 'meal',
          title: '空单',
          totalAmount: 0,
          items: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.reimbursement.create).not.toHaveBeenCalled();
    });

    it('存储总金额以服务端明细合计为准（不信任前端传入值），且明细合计一致时通过', async () => {
      await service.create({
        userId: 1,
        typeCode: 'meal',
        title: '重算金额',
        totalAmount: 200, // 前端传入 200，但明细合计为 200
        items: [
          { name: '交通', amount: 100 },
          { name: '餐费', amount: 100 },
        ],
      });
      const data = prisma.reimbursement.create.mock.calls[0][0].data;
      // 存入的 totalAmount 等于明细合计，而非原样信任前端字段
      expect(data.totalAmount).toBe(200);
      expect(data.totalAmount).toBe(data.items.create.reduce((s: number, it: any) => s + it.amount, 0));
    });

    it('明细合计与总金额不一致（>0.01）时拒绝创建', async () => {
      await expect(
        service.create({
          userId: 1,
          typeCode: 'meal',
          title: '金额不一致',
          totalAmount: 300,
          items: [{ name: '交通', amount: 100 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.reimbursement.create).not.toHaveBeenCalled();
    });
  });

  // ===== S1 二级费用类型 CRUD（对齐老项目 expense_types）=====
  describe('二级费用类型 - 列表', () => {
    it('listAllExpenseTypes 返回全部（含停用）', async () => {
      const rows = [
        { id: 1, name: '市内交通费', unit: '次', sortOrder: 0, status: 'active' },
        { id: 2, name: '招待餐费', sortOrder: 1, status: 'inactive' },
      ];
      prisma.expenseType.findMany.mockResolvedValue(rows);

      const result = await service.listAllExpenseTypes();
      expect(prisma.expenseType.findMany).toHaveBeenCalledWith({ orderBy: { id: 'asc' } });
      expect(result).toEqual(rows);
    });

    it('listExpenseTypes 仅返回启用项', async () => {
      const rows = [{ id: 1, name: '市内交通费', status: 'active' }];
      prisma.expenseType.findMany.mockResolvedValue(rows);

      const result = await service.listExpenseTypes();
      expect(prisma.expenseType.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual(rows);
    });
  });

  describe('二级费用类型 - 增改删', () => {
    it('createExpenseType 创建成功并默认启用', async () => {
      prisma.expenseType.create.mockResolvedValue({
        id: 9,
        name: '火车票',
        unit: '张',
        sortOrder: 0,
        status: 'active',
      });
      const result = await service.createExpenseType({ name: '火车票', unit: '张' });
      expect(prisma.expenseType.create).toHaveBeenCalledWith({
        data: { name: '火车票', unit: '张', sortOrder: 0, status: 'active' },
      });
      expect(result.status).toBe('active');
    });

    it('updateExpenseType 不存在时抛未找到', async () => {
      prisma.expenseType.findUnique.mockResolvedValue(null);
      await expect(service.updateExpenseType(99, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateExpenseType 更新名称/单位/排序/状态', async () => {
      prisma.expenseType.findUnique.mockResolvedValue({ id: 1, name: '火车票' });
      prisma.expenseType.update.mockResolvedValue({ id: 1, name: '高铁票', status: 'inactive' });
      const result = await service.updateExpenseType(1, {
        name: '高铁票',
        unit: '张',
        sortOrder: 2,
        status: 'inactive',
      });
      expect(prisma.expenseType.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: '高铁票', unit: '张', sortOrder: 2, status: 'inactive' },
      });
      expect(result.name).toBe('高铁票');
    });

    it('removeExpenseType 不存在时抛未找到，存在时删除', async () => {
      prisma.expenseType.findUnique.mockResolvedValue(null);
      await expect(service.removeExpenseType(99)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.expenseType.delete).not.toHaveBeenCalled();

      prisma.expenseType.findUnique.mockResolvedValue({ id: 1, name: '火车票' });
      prisma.expenseType.delete.mockResolvedValue({ id: 1 });
      const result = await service.removeExpenseType(1);
      expect(prisma.expenseType.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.success).toBe(true);
    });
  });

  // ===== S3 撤销报销 =====
  describe('cancel - 撤销报销申请', () => {
    const reim = { id: 5, applicantId: 1, status: 'pending' };

    beforeEach(() => {
      prisma.reimbursement.findUnique.mockResolvedValue(reim);
      prisma.reimbursement.update.mockResolvedValue({ ...reim, status: 'cancelled' });
    });

    it('非本人操作时禁止', async () => {
      await expect(service.cancel(5, 999)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.reimbursement.update).not.toHaveBeenCalled();
    });

    it('草稿/已通过/已驳回状态不可撤销', async () => {
      prisma.reimbursement.findUnique.mockResolvedValue({ ...reim, status: 'draft' });
      await expect(service.cancel(5, 1)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.reimbursement.update).not.toHaveBeenCalled();
    });

    it('审批中(pending/approving)可撤销，状态置为 cancelled', async () => {
      const result = await service.cancel(5, 1);
      expect(prisma.reimbursement.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: 'cancelled', approvalInstanceId: null },
      });
      expect(result.success).toBe(true);
    });
  });

  // ===== S4 删除报销 =====
  describe('remove - 删除报销申请', () => {
    beforeEach(() => {
      prisma.reimbursement.findUnique.mockResolvedValue({ id: 5, applicantId: 1, status: 'draft' });
      prisma.reimbursement.delete.mockResolvedValue({ id: 5 });
    });

    it('不存在时抛未找到', async () => {
      prisma.reimbursement.findUnique.mockResolvedValue(null);
      await expect(service.remove(5, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('非本人操作时禁止', async () => {
      await expect(service.remove(5, 999)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.reimbursement.delete).not.toHaveBeenCalled();
    });

    it('审批中(pending/approving)等状态不可删除', async () => {
      prisma.reimbursement.findUnique.mockResolvedValue({ id: 5, applicantId: 1, status: 'pending' });
      await expect(service.remove(5, 1)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.reimbursement.delete).not.toHaveBeenCalled();
    });

    it('草稿/撤销/驳回状态可删除，级联删除明细与附件', async () => {
      const result = await service.remove(5, 1);
      expect(prisma.reimbursement.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result.success).toBe(true);
    });
  });

  // ===== S5 详情含附件 =====
  describe('getDetail - 详情含明细与附件', () => {
    it('本人查看时额外返回 attachments', async () => {
      const reim = {
        id: 5,
        applicantId: 1,
        status: 'approved',
        items: [{ id: 1, amount: 50 }],
        attachments: [{ id: 1, fileName: 'a.pdf' }],
      };
      prisma.reimbursement.findUnique.mockResolvedValue(reim);

      const result = await service.getDetail(5, 1);
      expect(result.attachments).toEqual(reim.attachments);
      expect(prisma.reimbursement.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ attachments: true }) }),
      );
    });
  });

  // ===== S6 我的列表状态筛选 =====
  describe('listMine - 支持状态筛选', () => {
    it('传入 status 时按状态过滤', async () => {
      prisma.reimbursement.findMany.mockResolvedValue([]);
      prisma.reimbursement.count.mockResolvedValue(0);

      await service.listMine(1, 1, 10, 'draft');

      expect(prisma.reimbursement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { applicantId: 1, status: 'draft' } }),
      );
      expect(prisma.reimbursement.count).toHaveBeenCalledWith({
        where: { applicantId: 1, status: 'draft' },
      });
    });

    it('未传 status 时不过滤', async () => {
      prisma.reimbursement.findMany.mockResolvedValue([]);
      prisma.reimbursement.count.mockResolvedValue(0);

      await service.listMine(1, 1, 10);

      expect(prisma.reimbursement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { applicantId: 1 } }),
      );
    });
  });
});