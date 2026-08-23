import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { VacationService } from '../src/attendance/vacation.service';

const prisma = new PrismaClient();

describe('假期余额跨年结转', () => {
  let app: NestFastifyApplication;
  let vacationService: VacationService;
  let employeeId: number;
  let annualLeaveTypeId: number;
  let compensatoryLeaveTypeId: number;
  let sickLeaveTypeId: number;

  beforeAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();

    const adminUser = await prisma.user.create({
      data: { username: 'admin_carryover', passwordHash: await bcrypt.hash('123456', 10), realName: '管理员' },
    });

    const dept = await prisma.department.create({ data: { name: '研发部' } });
    const emp = await prisma.employee.create({
      data: {
        employeeNo: 'E007',
        name: '张员工',
        departmentId: dept.id,
        userId: adminUser.id,
        salary: 8000,
        hireDate: new Date('2020-06-15'),
        status: 'active',
      },
    });
    employeeId = emp.id;

    const annualType = await prisma.vacationType.create({
      data: {
        code: 'annual',
        name: '年假',
        baseDays: 5,
        sortOrder: 1,
        carryOverMaxDays: 3,
        seniorityRule: [
          { minYears: 0, maxYears: 1, days: 5 },
          { minYears: 1, maxYears: 10, days: 10 },
          { minYears: 10, maxYears: 20, days: 15 },
          { minYears: 20, maxYears: null, days: 20 },
        ] as any,
      },
    });
    annualLeaveTypeId = annualType.id;

    const compensatoryType = await prisma.vacationType.create({
      data: {
        code: 'compensatory',
        name: '调休',
        baseDays: 0,
        sortOrder: 2,
        carryOverRatio: 1,
      },
    });
    compensatoryLeaveTypeId = compensatoryType.id;

    const sickType = await prisma.vacationType.create({
      data: {
        code: 'sick',
        name: '病假',
        baseDays: 10,
        sortOrder: 3,
      },
    });
    sickLeaveTypeId = sickType.id;

    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.register(cookie as any);
    await app.init();

    vacationService = app.get(VacationService);
  });

  afterAll(async () => {
    await prisma.vacationBalanceChange.deleteMany();
    await prisma.vacationBalance.deleteMany();
    await prisma.leaveRecord.deleteMany();
    await prisma.overtimeRecord.deleteMany();
    await prisma.vacationType.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.permission.deleteMany();
    await app.close();
    await prisma.$disconnect();
  });

  describe('calculateAnnualLeaveDays - 工龄年假计算', () => {
    it('应该根据员工司龄计算年假天数 - 不满1年', async () => {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      const result = await vacationService.calculateAnnualLeaveDays({
        ...emp!,
        hireDate: new Date('2026-01-01'),
      });
      expect(Number(result)).toBe(5);
    });

    it('应该根据员工司龄计算年假天数 - 满1年不满10年', async () => {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      const result = await vacationService.calculateAnnualLeaveDays({
        ...emp!,
        hireDate: new Date('2020-06-15'),
      });
      expect(Number(result)).toBe(10);
    });

    it('应该根据员工司龄计算年假天数 - 满10年不满20年', async () => {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      const result = await vacationService.calculateAnnualLeaveDays({
        ...emp!,
        hireDate: new Date('2012-01-01'),
      });
      expect(Number(result)).toBe(15);
    });

    it('应该根据员工司龄计算年假天数 - 满20年以上', async () => {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      const result = await vacationService.calculateAnnualLeaveDays({
        ...emp!,
        hireDate: new Date('2000-01-01'),
      });
      expect(Number(result)).toBe(20);
    });

    it('没有 seniorityRule 的假期类型应该返回 baseDays', async () => {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      const sickType = await prisma.vacationType.findUnique({ where: { id: sickLeaveTypeId } });
      const result = await vacationService.calculateAnnualLeaveDays(emp!, sickType!);
      expect(Number(result)).toBe(10);
    });
  });

  describe('initializeYearBalances - 年初余额初始化', () => {
    it('应该为指定员工初始化某年所有假期类型的余额', async () => {
      const year = 2025;
      await vacationService.initializeYearBalances(year, employeeId);

      const balances = await prisma.vacationBalance.findMany({
        where: { employeeId, year },
        include: { vacationType: true },
        orderBy: { vacationType: { sortOrder: 'asc' } },
      });

      expect(balances.length).toBe(3);

      const annual = balances.find(b => b.vacationType.code === 'annual');
      expect(annual).toBeDefined();
      expect(Number(annual!.totalDays)).toBe(10);

      const compensatory = balances.find(b => b.vacationType.code === 'compensatory');
      expect(compensatory).toBeDefined();
      expect(Number(compensatory!.totalDays)).toBe(0);

      const sick = balances.find(b => b.vacationType.code === 'sick');
      expect(sick).toBeDefined();
      expect(Number(sick!.totalDays)).toBe(10);
    });

    it('重复初始化不应该创建重复记录（幂等）', async () => {
      const year = 2025;
      await vacationService.initializeYearBalances(year, employeeId);
      await vacationService.initializeYearBalances(year, employeeId);

      const count = await prisma.vacationBalance.count({
        where: { employeeId, year },
      });
      expect(count).toBe(3);
    });

    it('应该为所有员工初始化余额', async () => {
      const dept = await prisma.department.findFirst();
      const emp2 = await prisma.employee.create({
        data: {
          employeeNo: 'E008',
          name: '李员工',
          departmentId: dept!.id,
          salary: 7000,
          hireDate: new Date('2018-03-01'),
          status: 'active',
        },
      });

      const year = 2026;
      await vacationService.initializeYearBalances(year);

      const emp1Balances = await prisma.vacationBalance.findMany({
        where: { employeeId, year },
      });
      const emp2Balances = await prisma.vacationBalance.findMany({
        where: { employeeId: emp2.id, year },
      });

      expect(emp1Balances.length).toBe(3);
      expect(emp2Balances.length).toBe(3);

      const emp1Annual = emp1Balances.find(b => b.vacationTypeId === annualLeaveTypeId);
      expect(Number(emp1Annual!.totalDays)).toBe(10);

      const emp2Annual = emp2Balances.find(b => b.vacationTypeId === annualLeaveTypeId);
      expect(Number(emp2Annual!.totalDays)).toBe(10);

      await prisma.employee.delete({ where: { id: emp2.id } });
    });
  });

  describe('carryOverBalances - 跨年结转', () => {
    it('应该按 carryOverMaxDays 限制结转天数', async () => {
      const fromYear = 2024;
      const toYear = 2025;

      await prisma.vacationBalance.deleteMany({
        where: { employeeId, year: { in: [fromYear, toYear] } },
      });

      await prisma.vacationBalance.create({
        data: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          year: fromYear,
          totalDays: 10,
          usedDays: 5,
        },
      });

      await vacationService.carryOverBalances(fromYear, toYear);

      const toYearBalance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: annualLeaveTypeId,
            year: toYear,
          },
        },
      });

      expect(toYearBalance).toBeDefined();
      expect(Number(toYearBalance!.totalDays)).toBe(13);

      const changes = await prisma.vacationBalanceChange.findMany({
        where: { balanceId: toYearBalance!.id, changeType: 'addition' },
      });
      expect(changes.length).toBeGreaterThanOrEqual(1);
      const carryOverChange = changes.find(c => c.reason?.includes('结转'));
      expect(carryOverChange).toBeDefined();
      expect(Number(carryOverChange!.amount)).toBe(3);
    });

    it('应该按 carryOverRatio 比例结转', async () => {
      const fromYear = 2024;
      const toYear = 2025;

      await prisma.vacationBalance.deleteMany({
        where: { employeeId, vacationTypeId: compensatoryLeaveTypeId, year: { in: [fromYear, toYear] } },
      });

      await prisma.vacationBalance.create({
        data: {
          employeeId,
          vacationTypeId: compensatoryLeaveTypeId,
          year: fromYear,
          totalDays: 10,
          usedDays: 4,
        },
      });

      await vacationService.carryOverBalances(fromYear, toYear);

      const toYearBalance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: compensatoryLeaveTypeId,
            year: toYear,
          },
        },
      });

      expect(toYearBalance).toBeDefined();
      expect(Number(toYearBalance!.totalDays)).toBe(6);
    });

    it('没有结转规则的假期类型不结转', async () => {
      const fromYear = 2024;
      const toYear = 2025;

      await prisma.vacationBalance.deleteMany({
        where: { employeeId, vacationTypeId: sickLeaveTypeId, year: { in: [fromYear, toYear] } },
      });

      await prisma.vacationBalance.create({
        data: {
          employeeId,
          vacationTypeId: sickLeaveTypeId,
          year: fromYear,
          totalDays: 10,
          usedDays: 3,
        },
      });

      await vacationService.carryOverBalances(fromYear, toYear);

      const toYearBalance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: sickLeaveTypeId,
            year: toYear,
          },
        },
      });

      expect(toYearBalance).toBeDefined();
      expect(Number(toYearBalance!.totalDays)).toBe(10);
    });

    it('上年剩余为0时不结转', async () => {
      const fromYear = 2023;
      const toYear = 2024;

      await prisma.vacationBalance.deleteMany({
        where: { employeeId, year: { in: [fromYear, toYear] } },
      });

      await prisma.vacationBalance.create({
        data: {
          employeeId,
          vacationTypeId: annualLeaveTypeId,
          year: fromYear,
          totalDays: 10,
          usedDays: 10,
        },
      });

      await vacationService.carryOverBalances(fromYear, toYear);

      const toYearBalance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: annualLeaveTypeId,
            year: toYear,
          },
        },
      });

      expect(toYearBalance).toBeDefined();
      expect(Number(toYearBalance!.totalDays)).toBe(10);

      const changes = await prisma.vacationBalanceChange.findMany({
        where: { balanceId: toYearBalance!.id, changeType: 'addition' },
      });
      const carryOverChanges = changes.filter(c => c.reason?.includes('结转'));
      expect(carryOverChanges.length).toBe(0);
    });

    it('同时有 carryOverMaxDays 和 carryOverRatio 时取较小值', async () => {
      const fromYear = 2022;
      const toYear = 2023;

      const testType = await prisma.vacationType.create({
        data: {
          code: 'test_carryover',
          name: '测试结转',
          baseDays: 15,
          sortOrder: 10,
          carryOverMaxDays: 3,
          carryOverRatio: 0.5,
        },
      });

      await prisma.vacationBalance.deleteMany({
        where: { employeeId, vacationTypeId: testType.id, year: { in: [fromYear, toYear] } },
      });

      await prisma.vacationBalance.create({
        data: {
          employeeId,
          vacationTypeId: testType.id,
          year: fromYear,
          totalDays: 15,
          usedDays: 5,
        },
      });

      await vacationService.carryOverBalances(fromYear, toYear);

      const toYearBalance = await prisma.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId: testType.id,
            year: toYear,
          },
        },
      });

      expect(toYearBalance).toBeDefined();
      expect(Number(toYearBalance!.totalDays)).toBe(18);

      await prisma.vacationBalance.deleteMany({
        where: { employeeId, vacationTypeId: testType.id },
      });
      await prisma.vacationType.delete({ where: { id: testType.id } });
    });
  });
});
