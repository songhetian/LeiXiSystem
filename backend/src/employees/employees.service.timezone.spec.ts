/** @jest-environment ./jest-utc-environment */
// 生产容器未设置 TZ（即 UTC），而业务口径一律按北京时间。
// 本文件在 UTC 环境下验证「改薪默认次月生效」的月份推导不被容器时区带偏。
import { EmployeesService } from './employees.service';

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

describe('EmployeesService - 时区（容器 TZ=UTC）', () => {
  let service: EmployeesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmployeesService(mockPrisma, mockDataScope);
  });

  it('改薪默认生效月按北京时间推导：北京 3/1 02:00（UTC 仍是 2/28）应为 2026-04', async () => {
    mockDataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 1,
      name: '张三',
      departmentId: 1,
      salary: 5000,
      status: 'active',
      hireDate: new Date('2020-01-01'),
    });
    mockPrisma.employee.update.mockResolvedValue({ id: 1 });
    mockPrisma.salaryAdjustment.create.mockResolvedValue({ id: 1 });

    const RealDate: any = Date;
    const dateSpy = jest.spyOn(global, 'Date').mockImplementation(function (
      this: Date,
      ...args: any[]
    ) {
      return (args.length === 0
        ? new RealDate('2026-02-28T18:00:00.000Z')
        : new RealDate(...args)) as any;
    });

    try {
      await service.update(1, { salary: 10000 }, 1);
    } finally {
      dateSpy.mockRestore();
    }

    // 按业务规则「8 月改薪 → 9 月计薪月生效」，北京 3 月改薪应生效于 4 月；
    // 用本地时区推导会落到 3 月（比规则提前一个月发薪）。
    expect(mockPrisma.salaryAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ effectiveMonth: '2026-04' }),
      }),
    );
  });
});
