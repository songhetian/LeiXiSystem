import { EmployeesService } from './employees.service';
import { DataScopeService } from '../common/data-scope.service';
import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';
import * as ExcelJS from 'exceljs';

const mockPrisma: any = {
  employee: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  employeeChangeLog: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  employeeTagRelation: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  salaryAdjustment: {
    create: jest.fn(),
  },
  department: {
    findMany: jest.fn(),
  },
  position: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: any) => {
    const tx = {
      employee: {
        update: jest.fn().mockImplementation((args: any) => mockPrisma.employee.update(args)),
      },
      employeeChangeLog: {
        createMany: jest.fn().mockImplementation((args: any) => mockPrisma.employeeChangeLog.createMany(args)),
      },
      employeeTagRelation: {
        deleteMany: jest.fn().mockImplementation((args: any) => mockPrisma.employeeTagRelation.deleteMany(args)),
        createMany: jest.fn().mockImplementation((args: any) => mockPrisma.employeeTagRelation.createMany(args)),
      },
      salaryAdjustment: {
        create: jest.fn().mockImplementation((args: any) => mockPrisma.salaryAdjustment.create(args)),
      },
    };
    return fn(tx);
  }),
};

const mockDataScope: any = {
  visibleScope: jest.fn(),
};

describe('EmployeesService (敏感字段)', () => {
  let service: EmployeesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmployeesService(mockPrisma, mockDataScope);
  });

  describe('list', () => {
    it('列表接口不应返回 salary 等敏感字段（最小暴露原则）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 1, name: '张三', departmentId: 1, salary: 10000, status: 'active' },
      ]);
      mockPrisma.employee.count.mockResolvedValue(1);

      const result = await service.list(1, { page: 1, pageSize: 20 });

      expect(mockPrisma.employee.findMany).toHaveBeenCalled();
      const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];

      expect(callArgs.select).toBeDefined();
      expect(callArgs.select.salary).not.toBe(true);
    });

    it('返回的列表项同时带扁平化 departmentName/positionName（于嵌套 department/position 之上派生）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      const raws = [
        {
          id: 1,
          employeeNo: 'EMP0001',
          name: '张伟',
          departmentId: 3,
          positionId: 5,
          hireDate: new Date('2022-12-31T00:00:00.000Z'),
          status: 'active',
          rating: 1,
          phone: null,
          department: { id: 3, name: '技术部', parentId: null },
          position: { id: 5, name: '工程师' },
        },
        {
          id: 2,
          employeeNo: 'EMP0002',
          name: '王芳',
          departmentId: null,
          positionId: null,
          hireDate: new Date('2024-04-07T00:00:00.000Z'),
          status: 'active',
          rating: 1,
          phone: null,
          department: null,
          position: null,
        },
      ];
      mockPrisma.employee.findMany.mockResolvedValue(raws);
      mockPrisma.employee.count.mockResolvedValue(2);

      const result = await service.list(1, { page: 1, pageSize: 20 });

      expect(mockPrisma.employee.findMany).toHaveBeenCalled();
      expect(result.list).toHaveLength(2);
      expect(result.list[0]).toMatchObject({ departmentName: '技术部', positionName: '工程师' });
      // 无部门/岗位时兜底为空字符串/占位，避免前端渲染 undefined
      expect(result.list[1]).toMatchObject({ departmentName: '', positionName: '' });
      // 原有嵌套结构保留（detail/详情页读取 department.name）
      expect(result.list[0]).toHaveProperty('department');
      expect(result.list[0].department.name).toBe('技术部');
      expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    });
  });

  describe('list - 多维度搜索（部门/岗位/状态）', () => {
    const setupScope = (scope: any) => mockDataScope.visibleScope.mockResolvedValue(scope);
    const lastWhere = () => mockPrisma.employee.findMany.mock.calls[0][0].where;

    beforeEach(() => {
      mockPrisma.employee.findMany.mockResolvedValue([]);
      mockPrisma.employee.count.mockResolvedValue(0);
    });

    it('按 departmentId 过滤（管理员，scope.all=true）', async () => {
      setupScope({ all: true, ids: [], selfEmployeeId: null });
      await service.list(1, { page: 1, pageSize: 20, departmentId: 3 });
      expect(lastWhere().departmentId).toBe(3);
    });

    it('按 positionId 过滤', async () => {
      setupScope({ all: true, ids: [], selfEmployeeId: null });
      await service.list(1, { page: 1, pageSize: 20, positionId: 2 });
      expect(lastWhere().positionId).toBe(2);
    });

    it('按 status 过滤', async () => {
      setupScope({ all: true, ids: [], selfEmployeeId: null });
      await service.list(1, { page: 1, pageSize: 20, status: 'inactive' });
      expect(lastWhere().status).toBe('inactive');
    });

    it('部门过滤在数据范围内（部门限定角色）→ 生效', async () => {
      setupScope({ all: false, ids: [1, 2, 3], selfEmployeeId: null });
      await service.list(1, { page: 1, pageSize: 20, departmentId: 2 });
      expect(lastWhere().departmentId).toBe(2);
    });

    it('部门过滤越出数据范围 → 返回空（不会被越权过滤）', async () => {
      setupScope({ all: false, ids: [1, 2, 3], selfEmployeeId: null });
      await service.list(1, { page: 1, pageSize: 20, departmentId: 99 });
      expect(lastWhere().departmentId).toBe(-1);
    });

    it('本人数据范围（selfEmployeeId）时，过滤不影响按自身 id 限定', async () => {
      setupScope({ all: false, ids: [], selfEmployeeId: 7 });
      await service.list(7, { page: 1, pageSize: 20, departmentId: 99, positionId: 1 });
      expect(lastWhere().id).toBe(7);
    });
  });

  describe('detail', () => {
    it('详情接口有权限时应返回完整信息', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 1, name: '张三', departmentId: 1, salary: 10000, status: 'active',
      });

      const result = await service.detail(1, 1);

      expect(result.salary).toBeDefined();
    });
  });

  describe('updateMyProfile', () => {
    const mockEmployee = {
      id: 1,
      userId: 1,
      employeeNo: 'E001',
      name: '张三',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      address: '北京市朝阳区',
      idCard: '110101199001011234',
      bankAccount: '6222021234567890123',
      bankName: '工商银行',
      emergencyContact: '李四',
      emergencyPhone: '13900139000',
      departmentId: 1,
      positionId: 1,
      salary: 10000,
      status: 'active',
      hireDate: new Date('2020-01-01'),
    };

    beforeEach(() => {
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockImplementation(({ data }: any) => ({
        ...mockEmployee,
        ...data,
      }));
    });

    it('应允许修改 phone 字段', async () => {
      await service.updateMyProfile(1, { phone: '13900139001' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.phone).toBe('13900139001');
    });

    it('应允许修改 email 字段', async () => {
      await service.updateMyProfile(1, { email: 'new@example.com' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.email).toBe('new@example.com');
    });

    it('应允许修改 address 字段', async () => {
      await service.updateMyProfile(1, { address: '上海市浦东新区' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.address).toBe('上海市浦东新区');
    });

    it('应允许修改 emergencyContact 字段', async () => {
      await service.updateMyProfile(1, { emergencyContact: '王五' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.emergencyContact).toBe('王五');
    });

    it('应允许修改 emergencyPhone 字段', async () => {
      await service.updateMyProfile(1, { emergencyPhone: '13700137000' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.emergencyPhone).toBe('13700137000');
    });

    it('应允许修改 bankAccount 字段', async () => {
      await service.updateMyProfile(1, { bankAccount: '6222029999999999999' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.bankAccount).toBe('6222029999999999999');
    });

    it('应允许修改 bankName 字段', async () => {
      await service.updateMyProfile(1, { bankName: '建设银行' });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.bankName).toBe('建设银行');
    });

    it('不应允许修改 idCard 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { idCard: '110101199909099999' } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.idCard).toBeUndefined();
    });

    it('不应允许修改 name 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { name: '李四' } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.name).toBeUndefined();
    });

    it('不应允许修改 salary 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { salary: 99999 } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.salary).toBeUndefined();
    });

    it('不应允许修改 departmentId 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { departmentId: 99 } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.departmentId).toBeUndefined();
    });

    it('不应允许修改 positionId 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { positionId: 99 } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.positionId).toBeUndefined();
    });

    it('不应允许修改 status 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { status: 'resigned' } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.status).toBeUndefined();
    });

    it('不应允许修改 hireDate 敏感字段（白名单过滤）', async () => {
      await service.updateMyProfile(1, { hireDate: '2025-01-01' } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.hireDate).toBeUndefined();
    });

    it('应同时修改多个可修改字段', async () => {
      await service.updateMyProfile(1, {
        phone: '13900139001',
        email: 'new@example.com',
        address: '上海市浦东新区',
        emergencyContact: '王五',
        emergencyPhone: '13700137000',
        bankAccount: '6222029999999999999',
        bankName: '建设银行',
      });
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.phone).toBe('13900139001');
      expect(updateData.email).toBe('new@example.com');
      expect(updateData.address).toBe('上海市浦东新区');
      expect(updateData.emergencyContact).toBe('王五');
      expect(updateData.emergencyPhone).toBe('13700137000');
      expect(updateData.bankAccount).toBe('6222029999999999999');
      expect(updateData.bankName).toBe('建设银行');
    });

    it('混合传入可修改和不可修改字段时，只更新白名单内的字段', async () => {
      await service.updateMyProfile(1, {
        phone: '13900139001',
        salary: 99999,
        departmentId: 99,
        name: '李四',
      } as any);
      expect(mockPrisma.employee.update).toHaveBeenCalled();
      const updateData = mockPrisma.employee.update.mock.calls[0][0].data;
      expect(updateData.phone).toBe('13900139001');
      expect(updateData.salary).toBeUndefined();
      expect(updateData.departmentId).toBeUndefined();
      expect(updateData.name).toBeUndefined();
    });
  });

  describe('generateImportTemplate', () => {
    it('应生成包含正确表头和示例数据的 Excel 模板', async () => {
      const buffer = await service.generateImportTemplate();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      expect(sheet).toBeDefined();
      expect(sheet.name).toBe('员工导入模板');

      const headers = sheet.getRow(1).values as string[];
      expect(headers[1]).toBe('工号');
      expect(headers[2]).toBe('姓名');
      expect(headers[3]).toBe('部门');
      expect(headers[4]).toBe('职位');
      expect(headers[5]).toBe('手机号');
      expect(headers[6]).toBe('入职日期');

      const exampleRow = sheet.getRow(2).values as string[];
      expect(exampleRow[1]).toBe('E001');
      expect(exampleRow[2]).toBe('张三');
      expect(exampleRow[3]).toBe('技术部');
      expect(exampleRow[4]).toBe('工程师');
      expect(exampleRow[5]).toBe('13800138000');
      expect(exampleRow[6]).toBe('2026-01-01');
    });

    it('模板表头行应有样式（加粗、背景色）', async () => {
      const buffer = await service.generateImportTemplate();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      const headerRow = sheet.getRow(1);

      expect(headerRow.font?.bold).toBe(true);
      expect(headerRow.fill).toBeDefined();
    });

    it('模板示例行应为灰色斜体', async () => {
      const buffer = await service.generateImportTemplate();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      const exampleRow = sheet.getRow(2);

      expect(exampleRow.font?.italic).toBe(true);
      expect(exampleRow.font?.color).toBeDefined();
    });

    it('模板字段应与导入逻辑完全对应（6列）', async () => {
      const buffer = await service.generateImportTemplate();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];

      const headers = sheet.getRow(1).values as string[];
      const headerCount = headers.filter((h) => h && h.trim() !== '').length;
      expect(headerCount).toBe(6);
    });
  });

  describe('薪资非负校验', () => {
    describe('create - 创建员工', () => {
      it('薪资为负数时应抛出 PARAM_INVALID 错误', async () => {
        mockPrisma.employee.findUnique.mockResolvedValue(null);

        await expect(service.create({
          employeeNo: 'E001',
          name: '张三',
          salary: -1000,
          hireDate: '2026-01-01',
        })).rejects.toMatchObject({
          response: { code: ERROR_CODES.PARAM_INVALID, message: '员工薪资不能为负' },
        });
      });

      it('薪资为 0 时应允许创建', async () => {
        mockPrisma.employee.findUnique.mockResolvedValue(null);
        mockPrisma.employee.create.mockResolvedValue({ id: 1 });

        await expect(service.create({
          employeeNo: 'E001',
          name: '张三',
          salary: 0,
          hireDate: '2026-01-01',
        })).resolves.toBeDefined();
      });

      it('薪资为正数时应允许创建', async () => {
        mockPrisma.employee.findUnique.mockResolvedValue(null);
        mockPrisma.employee.create.mockResolvedValue({ id: 1 });

        await expect(service.create({
          employeeNo: 'E001',
          name: '张三',
          salary: 5000,
          hireDate: '2026-01-01',
        })).resolves.toBeDefined();
      });
    });

    describe('update - 修改员工', () => {
      const mockEmployee = {
        id: 1,
        name: '张三',
        departmentId: 1,
        salary: 5000,
        status: 'active',
        hireDate: new Date('2020-01-01'),
      };

      beforeEach(() => {
        mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
        mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
        mockPrisma.employee.update.mockResolvedValue(mockEmployee);
      });

      it('薪资为负数时应抛出 PARAM_INVALID 错误', async () => {
        await expect(service.update(1, { salary: -1000 }, 1)).rejects.toMatchObject({
          response: { code: ERROR_CODES.PARAM_INVALID, message: '员工薪资不能为负' },
        });
      });

      it('薪资为 0 时应允许修改', async () => {
        await expect(service.update(1, { salary: 0 }, 1)).resolves.toBeDefined();
      });

      it('薪资为正数时应允许修改', async () => {
        await expect(service.update(1, { salary: 6000 }, 1)).resolves.toBeDefined();
      });

      it('薪资变化时写入薪资调整留痕，生效月默认次月', async () => {
        // 当前薪资 5000 → 改为 10000；mock 今天=2026-08-28 → 默认生效月 2026-09
        const RealDate: any = Date;
        const dateSpy = jest.spyOn(global, 'Date').mockImplementation(function (
          this: Date,
          ...args: any[]
        ) {
          return (args.length === 0
            ? new RealDate(2026, 7, 28)
            : new RealDate(...args)) as any;
        });
        mockPrisma.salaryAdjustment.create.mockResolvedValue({ id: 1 });

        try {
          await service.update(1, { salary: 10000 }, 1);
        } finally {
          dateSpy.mockRestore();
        }

        expect(mockPrisma.salaryAdjustment.create).toHaveBeenCalledWith({
          data: {
            employeeId: 1,
            amount: 10000,
            effectiveMonth: '2026-09',
            remark: '默认次月生效（2026-09）',
            changedBy: 1,
          },
        });
        // 生效月不落入 employee.update 标量字段
        const callArgs = mockPrisma.employee.update.mock.calls[0][0];
        expect(callArgs.data.effectiveMonth).toBeUndefined();
      });

      it('传入指定的生效月时，按指定月写入（不进 employee.update）', async () => {
        mockPrisma.salaryAdjustment.create.mockResolvedValue({ id: 1 });

        await service.update(1, { salary: 12000, effectiveMonth: '2026-10' }, 1);

        expect(mockPrisma.salaryAdjustment.create).toHaveBeenCalledWith({
          data: {
            employeeId: 1,
            amount: 12000,
            effectiveMonth: '2026-10',
            remark: '指定生效月 2026-10',
            changedBy: 1,
          },
        });
        const callArgs = mockPrisma.employee.update.mock.calls[0][0];
        expect(callArgs.data.effectiveMonth).toBeUndefined();
      });

      it('薪资未变化时不写入薪资调整留痕', async () => {
        // 当前薪资 5000，未改薪资
        mockPrisma.salaryAdjustment.create.mockResolvedValue({ id: 1 });

        await service.update(1, { name: '李四' }, 1);

        expect(mockPrisma.salaryAdjustment.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('员工-标签绑定', () => {
    it('create 传入 tagIds 时，通过 tagRelations 嵌套创建关联', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);
      mockPrisma.employee.create.mockResolvedValue({ id: 1, name: '张三' });

      await expect(service.create({
        name: '张三',
        departmentId: 1,
        hireDate: '2026-01-01',
        tagIds: [3, 5],
      })).resolves.toBeDefined();

      const callArgs = mockPrisma.employee.create.mock.calls[0][0];
      expect(callArgs.data.tagRelations.create).toEqual([
        { tagId: 3 },
        { tagId: 5 },
      ]);
    });

    it('update 传入 tagIds 时，先清空再重建标签关联（事务内）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      const mockEmployee = { id: 1, name: '张三', departmentId: 1, status: 'active', hireDate: new Date('2020-01-01') };
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue(mockEmployee);
      mockPrisma.employeeTagRelation.createMany.mockResolvedValue({ count: 2 });

      await service.update(1, { name: '李四', tagIds: [1, 2] }, 1);

      expect(mockPrisma.employeeTagRelation.deleteMany).toHaveBeenCalledWith({
        where: { employeeId: 1 },
      });
      expect(mockPrisma.employeeTagRelation.createMany).toHaveBeenCalledWith({
        data: [
          { employeeId: 1, tagId: 1 },
          { employeeId: 1, tagId: 2 },
        ],
      });
    });

    it('update 未传 tagIds 时，不触碰标签关联（保持原有标签）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      const mockEmployee = { id: 1, name: '张三', departmentId: 1, status: 'active', hireDate: new Date('2020-01-01') };
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.employee.update.mockResolvedValue(mockEmployee);

      await service.update(1, { name: '李四' }, 1);

      expect(mockPrisma.employeeTagRelation.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.employeeTagRelation.createMany).not.toHaveBeenCalled();
    });

    it('list 将 tagRelations 扁平化为 tags 数组（id/name/color）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      const raws = [
        {
          id: 1,
          employeeNo: 'EMP0001',
          name: '张伟',
          departmentId: 3,
          positionId: null,
          hireDate: new Date('2022-12-31T00:00:00.000Z'),
          rating: 1,
          phone: null,
          status: 'active',
          department: { id: 3, name: '技术部', parentId: null },
          position: null,
          tagRelations: [
            { tag: { id: 3, name: '核心骨干', color: '#EF4444' } },
            { tag: { id: 5, name: '试用期', color: '#16A34A' } },
          ],
        },
      ];
      mockPrisma.employee.findMany.mockResolvedValue(raws);
      mockPrisma.employee.count.mockResolvedValue(1);

      const result = await service.list(1, { page: 1, pageSize: 20 });

      expect(result.list[0]).toMatchObject({
        tags: [
          { id: 3, name: '核心骨干', color: '#EF4444' },
          { id: 5, name: '试用期', color: '#16A34A' },
        ],
      });
      expect(mockPrisma.employee.findMany.mock.calls[0][0].select.tagRelations).toBeDefined();
    });
  });

  describe('listChangeLogs（全员工变动流水）', () => {
    const mockLog = {
      id: 1,
      employeeId: 7,
      field: 'departmentId',
      oldValue: '1',
      newValue: '2',
      changeType: 'admin_update',
      createdAt: new Date('2026-08-01'),
      employee: {
        employeeNo: 'E007',
        name: '张三',
        department: { id: 2, name: '技术部' },
        position: { id: 3, name: '工程师' },
      },
    };

    beforeEach(() => {
      mockPrisma.employeeChangeLog.findMany.mockResolvedValue([mockLog]);
      mockPrisma.employeeChangeLog.count.mockResolvedValue(1);
    });

    it('管理员可查看全员工变动流水（分页 + join 员工信息）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      const result = await (service as any).listChangeLogs(1, { page: 1, pageSize: 20 });

      const call = mockPrisma.employeeChangeLog.findMany.mock.calls[0][0];
      expect(call.where).toEqual({});
      expect(call.include.employee.select.employeeNo).toBe(true);
      expect(call.include.employee.select.name).toBe(true);
      expect(call.orderBy.createdAt).toBe('desc');
      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.employeeChangeLog.count).toHaveBeenCalled();
    });

    it('按 changeType 过滤变动流水', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      await (service as any).listChangeLogs(1, { page: 1, pageSize: 20, changeType: 'resign' });
      expect(mockPrisma.employeeChangeLog.findMany.mock.calls[0][0].where.changeType).toBe('resign');
    });

    it('部门受限时仅返回可见部门员工的变动流水（不越权）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: false, ids: [1, 2], selfEmployeeId: null });
      await (service as any).listChangeLogs(1, { page: 1, pageSize: 20 });
      expect(mockPrisma.employeeChangeLog.findMany.mock.calls[0][0].where.employee.departmentId).toEqual({ in: [1, 2] });
    });

    it('本人数据范围时仅返回本人变动', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: 7 });
      await (service as any).listChangeLogs(7, { page: 1, pageSize: 20 });
      expect(mockPrisma.employeeChangeLog.findMany.mock.calls[0][0].where.employeeId).toBe(7);
    });

    it('按部门过滤流水（管理员传入 departmentId）', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      await (service as any).listChangeLogs(1, { page: 1, pageSize: 20, departmentId: 5 });

      const call = mockPrisma.employeeChangeLog.findMany.mock.calls[0][0];
      expect(call.where.employee.departmentId).toEqual({ in: [5] });
    });

    it('部门受限且传入越权部门时，置空结果不越权', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: false, ids: [2, 3], selfEmployeeId: null });
      await (service as any).listChangeLogs(1, { page: 1, pageSize: 20, departmentId: 99 });

      const call = mockPrisma.employeeChangeLog.findMany.mock.calls[0][0];
      expect(call.where.employee.departmentId).toEqual({ in: [-1] });
    });
  });

  describe('batchUpdate（批量调整部门/岗位/职级）', () => {
    it('批量更新部门/岗位/职级并记录变更流水', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 1, departmentId: 1, status: 'active' },
        { id: 2, departmentId: 1, status: 'active' },
      ]);

      const result = await (service as any).batchUpdate(1, {
        ids: [1, 2],
        data: { departmentId: 5, positionId: 8, rating: 3 },
      });

      expect(result).toEqual({ success: 2, skipped: 0 });
      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } } });
      // 每个员工都写入调整字段
      const updateCalls = mockPrisma.employee.update.mock.calls;
      expect(updateCalls.length).toBe(2);
      for (const [args] of updateCalls) {
        expect(args.data.departmentId).toBe(5);
        expect(args.data.positionId).toBe(8);
        expect(args.data.rating).toBe(3);
      }
    });

    it('空选择抛参数校验错误（BadRequest）', async () => {
      await expect(
        (service as any).batchUpdate(1, { ids: [], data: { rating: 2 } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('越权部门员工跳过，不影响本范围员工', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: false, ids: [1], selfEmployeeId: null });
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 1, departmentId: 1, status: 'active' },
        { id: 2, departmentId: 2, status: 'active' },
      ]);

      const result = await (service as any).batchUpdate(1, { ids: [1, 2], data: { rating: 2 } });
      expect(result).toEqual({ success: 1, skipped: 1 });
      // 仅 1 个员工被更新
      expect(mockPrisma.employee.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('resign（办理离职，可带离职原因）', () => {
    const activeEmp = { id: 1, name: '张三', departmentId: 1, status: 'active', resignDate: null };

    it('使用传入离职日期与原因，写入 status/resignDate 并记录离职原因变更流水', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      mockPrisma.employee.findUnique.mockResolvedValue(activeEmp);
      mockPrisma.employee.update.mockResolvedValue({ ...activeEmp, status: 'resigned' });
      mockPrisma.employeeChangeLog.createMany.mockResolvedValue({ count: 3 });

      await service.resign(1, 999, { resignDate: '2026-08-27', reason: '个人发展方向' });

      const updateArg = mockPrisma.employee.update.mock.calls[0][0];
      expect(updateArg.where.id).toBe(1);
      expect(updateArg.data.status).toBe('resigned');
      expect(updateArg.data.resignDate).toEqual(new Date('2026-08-27'));

      const createManyArg = mockPrisma.employeeChangeLog.createMany.mock.calls[0][0];
      const logs = createManyArg.data;
      expect(logs.some((l: any) => l.field === 'resignReason' && l.newValue === '个人发展方向')).toBe(true);
      expect(logs.some((l: any) => l.field === 'status' && l.newValue === 'resigned')).toBe(true);
    });

    it('未传原因时不记录离职原因流水', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      mockPrisma.employee.findUnique.mockResolvedValue(activeEmp);
      mockPrisma.employee.update.mockResolvedValue({ ...activeEmp, status: 'resigned' });
      mockPrisma.employeeChangeLog.createMany.mockResolvedValue({ count: 2 });

      await service.resign(1, 999, { resignDate: '2026-08-27' });

      const createManyArg = mockPrisma.employeeChangeLog.createMany.mock.calls[0][0];
      expect(createManyArg.data.some((l: any) => l.field === 'resignReason')).toBe(false);
    });

    it('未传日期时默认使用当天', async () => {
      mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      mockPrisma.employee.findUnique.mockResolvedValue(activeEmp);
      mockPrisma.employee.update.mockResolvedValue({ ...activeEmp, status: 'resigned' });

      const before = new Date();
      await service.resign(1, 999, {});
      const after = new Date();
      const resignDate = mockPrisma.employee.update.mock.calls[0][0].data.resignDate as Date;
      expect(resignDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(resignDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('updateMyProfile（个人档案）错误码语义', () => {
    it('未找到员工档案时应报「员工不存在」，不得复用 1004（员工已离职）', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      let payload: any;
      try {
        await service.updateMyProfile(999, { phone: '13800000000' });
      } catch (e: any) {
        payload = e.getResponse?.() ?? e.response;
      }

      expect(payload.code).toBe(ERROR_CODES.EMPLOYEE_NOT_FOUND);
      expect(messageOf(payload.code)).toBe('员工不存在');
    });
  });
});