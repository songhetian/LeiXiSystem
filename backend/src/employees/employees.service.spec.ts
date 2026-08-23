import { EmployeesService } from './employees.service';
import { DataScopeService } from '../common/data-scope.service';
import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
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
        createMany: jest.fn(),
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
    });
  });
});
