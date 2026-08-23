import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { RedisService } from '../common/redis/redis.service';
import { Prisma, ExportTaskStatus, ProbationStatus, EmployeeStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { calculateTenure, formatAvgTenure } from '../common/date.util';
import { createHash } from 'crypto';

type GroupByPeriod = 'month' | 'quarter' | 'year';

const REPORT_CACHE_TTL = {
  employeeStructure: 600,
  hiringTrend: 600,
  probationPassRate: 600,
  laborCost: 300,
  attendanceMonthly: 300,
  attendanceAbnormal: 300,
  approvalEfficiency: 300,
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private redis: RedisService,
  ) {}

  private getPeriodKey(date: Date, groupBy: GroupByPeriod): string {
    const year = date.getFullYear();
    if (groupBy === 'year') {
      return String(year);
    }
    if (groupBy === 'quarter') {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private generateCacheKey(reportName: string, params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    const hash = createHash('md5').update(JSON.stringify(sorted)).digest('hex');
    return `report:${reportName}:${hash}`;
  }

  private async getCache<T>(key: string): Promise<T | null> {
    if (!this.redis.isEnabled) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      return null;
    } catch (e: any) {
      this.logger.warn(`读取缓存失败 [${key}]: ${e.message}`);
      return null;
    }
  }

  private async setCache(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.redis.isEnabled) return;
    try {
      await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    } catch (e: any) {
      this.logger.warn(`写入缓存失败 [${key}]: ${e.message}`);
    }
  }

  async clearReportCache(pattern: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    try {
      const client = this.redis.getClient();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.log(`清除报表缓存: ${keys.length} 个 key`);
      }
    } catch (e: any) {
      this.logger.warn(`清除缓存失败: ${e.message}`);
    }
  }

  async attendanceMonthly(params: { month: string; userId: number; departmentId?: number }) {
    const cacheKey = this.generateCacheKey('attendance-monthly', params);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const { month, userId, departmentId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: any = { month };
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (departmentId) {
      if (where.employee && typeof where.employee === 'object') {
        where.employee = { ...where.employee, departmentId };
      } else {
        where.employee = { departmentId };
      }
    }

    const records = await this.prisma.attendanceMonthly.findMany({
      where,
      include: {
        employee: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });

    const deptMap = new Map<number, {
      id: number;
      name: string;
      employeeCount: number;
      totalWorkDays: Prisma.Decimal;
      totalLateCount: number;
      totalEarlyCount: number;
      totalAbsentDays: Prisma.Decimal;
      totalOvertimeHours: Prisma.Decimal;
    }>();

    let totalEmployees = 0;
    let totalWorkDays = new Prisma.Decimal(0);
    let totalLateCount = 0;
    let totalEarlyCount = 0;
    let totalAbsentDays = new Prisma.Decimal(0);
    let totalOvertimeHours = new Prisma.Decimal(0);

    for (const r of records) {
      const dept = r.employee.department;
      if (!dept) continue;

      if (!deptMap.has(dept.id)) {
        deptMap.set(dept.id, {
          id: dept.id,
          name: dept.name,
          employeeCount: 0,
          totalWorkDays: new Prisma.Decimal(0),
          totalLateCount: 0,
          totalEarlyCount: 0,
          totalAbsentDays: new Prisma.Decimal(0),
          totalOvertimeHours: new Prisma.Decimal(0),
        });
      }

      const d = deptMap.get(dept.id)!;
      d.employeeCount += 1;
      d.totalWorkDays = d.totalWorkDays.plus(r.workDays);
      d.totalLateCount += r.lateCount;
      d.totalEarlyCount += r.earlyCount;
      d.totalAbsentDays = d.totalAbsentDays.plus(r.absentDays);
      d.totalOvertimeHours = d.totalOvertimeHours.plus(r.overtimeHours);

      totalEmployees += 1;
      totalWorkDays = totalWorkDays.plus(r.workDays);
      totalLateCount += r.lateCount;
      totalEarlyCount += r.earlyCount;
      totalAbsentDays = totalAbsentDays.plus(r.absentDays);
      totalOvertimeHours = totalOvertimeHours.plus(r.overtimeHours);
    }

    const departments = Array.from(deptMap.values()).map((d) => ({
      ...d,
      totalWorkDays: d.totalWorkDays.toString(),
      totalAbsentDays: d.totalAbsentDays.toString(),
      totalOvertimeHours: d.totalOvertimeHours.toString(),
    }));

    return {
      summary: {
        totalEmployees,
        totalWorkDays: totalWorkDays.toString(),
        totalLateCount,
        totalEarlyCount,
        totalAbsentDays: totalAbsentDays.toString(),
        totalOvertimeHours: totalOvertimeHours.toString(),
      },
      departments,
    };
  }

  async laborCost(params: { month: string; userId: number; departmentId?: number }) {
    const cacheKey = this.generateCacheKey('labor-cost', params);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const { month, userId, departmentId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const run = await this.prisma.payrollRun.findUnique({
      where: { month },
    });
    if (!run) {
      return {
        summary: {
          totalEmployees: 0,
          totalBaseSalary: '0',
          totalOvertimePay: '0',
          totalDeduction: '0',
          totalSalaryAmount: '0',
          totalRecruitmentCost: '0',
          totalTrainingCost: '0',
          totalAmount: '0',
        },
        departments: [],
      };
    }

    const where: any = { runId: run.id };
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (departmentId) {
      if (where.employee && typeof where.employee === 'object') {
        where.employee = { ...where.employee, departmentId };
      } else {
        where.employee = { departmentId };
      }
    }

    const details = await this.prisma.payrollDetail.findMany({
      where,
      include: {
        employee: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });

    const costWhereDeptIds = !scope.all && !scope.selfEmployeeId ? scope.ids : undefined;
    const costStartDate = new Date(`${month}-01`);
    const costEndDate = new Date(new Date(`${month}-01`).setMonth(costStartDate.getMonth() + 1));

    const recruitmentCostWhere: any = {
      costDate: { gte: costStartDate, lt: costEndDate },
    };
    const trainingCostWhere: any = {
      costDate: { gte: costStartDate, lt: costEndDate },
    };

    if (costWhereDeptIds) {
      recruitmentCostWhere.departmentId = { in: costWhereDeptIds };
      trainingCostWhere.departmentId = { in: costWhereDeptIds };
    }
    if (departmentId) {
      recruitmentCostWhere.departmentId = departmentId;
      trainingCostWhere.departmentId = departmentId;
    }

    const [recruitmentCosts, trainingCosts] = await Promise.all([
      this.prisma.recruitmentCost.findMany({
        where: recruitmentCostWhere,
        include: { department: { select: { id: true, name: true } } },
      }),
      this.prisma.trainingCost.findMany({
        where: trainingCostWhere,
        include: { department: { select: { id: true, name: true } } },
      }),
    ]);

    type DeptStat = {
      id: number;
      name: string;
      employeeCount: Set<number>;
      totalBaseSalary: Prisma.Decimal;
      totalOvertimePay: Prisma.Decimal;
      totalDeduction: Prisma.Decimal;
      totalSalaryAmount: Prisma.Decimal;
      totalRecruitmentCost: Prisma.Decimal;
      totalTrainingCost: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
    };

    const deptMap = new Map<number, DeptStat>();
    const allEmployees = new Set<number>();
    let totalBaseSalary = new Prisma.Decimal(0);
    let totalOvertimePay = new Prisma.Decimal(0);
    let totalDeduction = new Prisma.Decimal(0);
    let totalSalaryAmount = new Prisma.Decimal(0);
    let totalRecruitmentCost = new Prisma.Decimal(0);
    let totalTrainingCost = new Prisma.Decimal(0);
    let totalAmount = new Prisma.Decimal(0);

    for (const d of details) {
      const dept = d.employee.department;
      if (!dept) continue;

      if (!deptMap.has(dept.id)) {
        deptMap.set(dept.id, {
          id: dept.id,
          name: dept.name,
          employeeCount: new Set(),
          totalBaseSalary: new Prisma.Decimal(0),
          totalOvertimePay: new Prisma.Decimal(0),
          totalDeduction: new Prisma.Decimal(0),
          totalSalaryAmount: new Prisma.Decimal(0),
          totalRecruitmentCost: new Prisma.Decimal(0),
          totalTrainingCost: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(0),
        });
      }

      const stat = deptMap.get(dept.id)!;
      stat.employeeCount.add(d.employeeId);
      allEmployees.add(d.employeeId);

      const amt = new Prisma.Decimal(d.amount);
      if (d.itemCode === 'base_salary') {
        stat.totalBaseSalary = stat.totalBaseSalary.plus(amt);
        totalBaseSalary = totalBaseSalary.plus(amt);
      } else if (d.itemCode === 'overtime_pay') {
        stat.totalOvertimePay = stat.totalOvertimePay.plus(amt);
        totalOvertimePay = totalOvertimePay.plus(amt);
      } else if (amt.lessThan(0)) {
        stat.totalDeduction = stat.totalDeduction.plus(amt);
        totalDeduction = totalDeduction.plus(amt);
      }
      stat.totalSalaryAmount = stat.totalSalaryAmount.plus(amt);
      totalSalaryAmount = totalSalaryAmount.plus(amt);
    }

    for (const rc of recruitmentCosts) {
      const dept = rc.department;
      if (!dept) continue;

      if (!deptMap.has(dept.id)) {
        deptMap.set(dept.id, {
          id: dept.id,
          name: dept.name,
          employeeCount: new Set(),
          totalBaseSalary: new Prisma.Decimal(0),
          totalOvertimePay: new Prisma.Decimal(0),
          totalDeduction: new Prisma.Decimal(0),
          totalSalaryAmount: new Prisma.Decimal(0),
          totalRecruitmentCost: new Prisma.Decimal(0),
          totalTrainingCost: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(0),
        });
      }

      const stat = deptMap.get(dept.id)!;
      const amt = new Prisma.Decimal(rc.amount);
      stat.totalRecruitmentCost = stat.totalRecruitmentCost.plus(amt);
      totalRecruitmentCost = totalRecruitmentCost.plus(amt);
    }

    for (const tc of trainingCosts) {
      const dept = tc.department;
      if (!dept) continue;

      if (!deptMap.has(dept.id)) {
        deptMap.set(dept.id, {
          id: dept.id,
          name: dept.name,
          employeeCount: new Set(),
          totalBaseSalary: new Prisma.Decimal(0),
          totalOvertimePay: new Prisma.Decimal(0),
          totalDeduction: new Prisma.Decimal(0),
          totalSalaryAmount: new Prisma.Decimal(0),
          totalRecruitmentCost: new Prisma.Decimal(0),
          totalTrainingCost: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(0),
        });
      }

      const stat = deptMap.get(dept.id)!;
      const amt = new Prisma.Decimal(tc.amount);
      stat.totalTrainingCost = stat.totalTrainingCost.plus(amt);
      totalTrainingCost = totalTrainingCost.plus(amt);
    }

    for (const stat of deptMap.values()) {
      stat.totalAmount = stat.totalSalaryAmount.plus(stat.totalRecruitmentCost).plus(stat.totalTrainingCost);
    }
    totalAmount = totalSalaryAmount.plus(totalRecruitmentCost).plus(totalTrainingCost);

    const departments = Array.from(deptMap.values()).map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d.employeeCount.size,
      totalBaseSalary: d.totalBaseSalary.toString(),
      totalOvertimePay: d.totalOvertimePay.toString(),
      totalDeduction: d.totalDeduction.toString(),
      totalSalaryAmount: d.totalSalaryAmount.toString(),
      totalRecruitmentCost: d.totalRecruitmentCost.toString(),
      totalTrainingCost: d.totalTrainingCost.toString(),
      totalAmount: d.totalAmount.toString(),
    }));

    const result = {
      summary: {
        totalEmployees: allEmployees.size,
        totalBaseSalary: totalBaseSalary.toString(),
        totalOvertimePay: totalOvertimePay.toString(),
        totalDeduction: totalDeduction.toString(),
        totalSalaryAmount: totalSalaryAmount.toString(),
        totalRecruitmentCost: totalRecruitmentCost.toString(),
        totalTrainingCost: totalTrainingCost.toString(),
        totalAmount: totalAmount.toString(),
      },
      departments,
    };

    await this.setCache(cacheKey, result, REPORT_CACHE_TTL.laborCost);
    return result;
  }

  async employeeStructure(userId: number) {
    const cacheKey = this.generateCacheKey('employee-structure', { userId });
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.EmployeeWhereInput = {
      status: { in: [EmployeeStatus.active, EmployeeStatus.probation] },
    };
    if (scope.selfEmployeeId) {
      where.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true, education: true, departmentId: true,
        department: { select: { id: true, name: true } },
        hireDate: true, status: true, gender: true,
      } as any,
    }) as any[];

    const total = employees.length;

    const byDept: Record<string, { name: string; count: number }> = {};
    const byEducation: Record<string, number> = {};
    const byGender: Record<string, number> = { male: 0, female: 0, unknown: 0 };
    const tenureBuckets = [
      { name: '0-1年', min: 0, max: 1, count: 0 },
      { name: '1-3年', min: 1, max: 3, count: 0 },
      { name: '3-5年', min: 3, max: 5, count: 0 },
      { name: '5-10年', min: 5, max: 10, count: 0 },
      { name: '10年以上', min: 10, max: Infinity, count: 0 },
    ];

    let onProbation = 0;
    const now = new Date();

    let totalTenureDays = 0;
    let totalTenureMonths = 0;
    let totalTenureYears = 0;

    for (const emp of employees) {
      if (emp.department) {
        const key = String(emp.departmentId);
        if (!byDept[key]) byDept[key] = { name: emp.department.name, count: 0 };
        byDept[key].count++;
      }

      if (emp.education) {
        byEducation[emp.education] = (byEducation[emp.education] || 0) + 1;
      }

      if (emp.status === EmployeeStatus.probation) onProbation++;

      if (emp.gender === 'male' || emp.gender === 'female') {
        byGender[emp.gender]++;
      } else {
        byGender.unknown++;
      }

      const tenure = calculateTenure(emp.hireDate, now);
      totalTenureDays += tenure.totalDays;
      totalTenureMonths += tenure.totalMonths;
      totalTenureYears += tenure.totalYears;

      const bucket = tenureBuckets.find((b) => tenure.totalYears >= b.min && tenure.totalYears < b.max);
      if (bucket) bucket.count++;
    }

    const avgTenureDays = total > 0 ? Math.floor(totalTenureDays / total) : 0;
    const avgTenureMonths = total > 0 ? Number((totalTenureMonths / total).toFixed(1)) : 0;
    const avgTenureYears = total > 0 ? Number((totalTenureYears / total).toFixed(2)) : 0;

    const result = {
      total,
      byDepartment: Object.values(byDept),
      byEducation: Object.entries(byEducation).map(([name, count]) => ({ name, count })),
      byGender: Object.entries(byGender).map(([name, count]) => ({ name, count })),
      byTenure: tenureBuckets.map((b) => ({ name: b.name, count: b.count })),
      onProbation,
      avgTenure: {
        years: avgTenureYears,
        months: avgTenureMonths,
        days: avgTenureDays,
        formatted: formatAvgTenure(avgTenureYears),
      },
    };

    await this.setCache(cacheKey, result, REPORT_CACHE_TTL.employeeStructure);
    return result;
  }

  async getHiringTrend(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'department' | GroupByPeriod;
    departmentId?: number;
    userId: number;
  }) {
    const cacheKey = this.generateCacheKey('hiring-trend', params);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, groupBy, departmentId, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodGroup = (groupBy === 'department' ? 'month' : groupBy || 'month') as GroupByPeriod;

    const baseWhere: Prisma.EmployeeWhereInput = {};
    if (scope.selfEmployeeId) {
      baseWhere.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      baseWhere.departmentId = { in: scope.ids };
    }
    if (departmentId) {
      baseWhere.departmentId = departmentId;
    }

    const hiredWhere = {
      ...baseWhere,
      hireDate: { gte: start, lt: end },
    };

    const resignedWhere = {
      ...baseWhere,
      resignDate: { gte: start, lt: end },
      status: EmployeeStatus.resigned,
    };

    const openingWhere = {
      ...baseWhere,
      hireDate: { lt: start },
      OR: [
        { resignDate: { gte: start } },
        { resignDate: null },
      ],
    };

    const [hiredEmployees, resignedEmployees, openingEmployees] = await Promise.all([
      this.prisma.employee.findMany({
        where: hiredWhere,
        select: {
          id: true,
          hireDate: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.employee.findMany({
        where: resignedWhere,
        select: {
          id: true,
          resignDate: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.employee.findMany({
        where: openingWhere,
        select: {
          id: true,
          hireDate: true,
          resignDate: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      }),
    ]);

    const totalHired = hiredEmployees.length;
    const totalResigned = resignedEmployees.length;
    const totalOpening = openingEmployees.length;
    const totalClosing = totalOpening + totalHired - totalResigned;
    const turnoverRate = totalOpening + totalHired > 0
      ? Number(((totalResigned / (totalOpening + totalHired)) * 100).toFixed(1))
      : 0;

    let periods: { period: string; opening: number; hired: number; resigned: number; closing: number; turnoverRate: number }[] = [];
    let byDepartment: { departmentId: number; name: string; opening: number; hired: number; resigned: number; closing: number; turnoverRate: number }[] | undefined;

    if (!groupBy || groupBy !== 'department') {
      const periodMap = new Map<string, { opening: number; hired: number; resigned: number; closing: number }>();

      for (const emp of hiredEmployees) {
        const key = this.getPeriodKey(emp.hireDate, periodGroup);
        if (!periodMap.has(key)) {
          periodMap.set(key, { opening: 0, hired: 0, resigned: 0, closing: 0 });
        }
        periodMap.get(key)!.hired++;
      }

      for (const emp of resignedEmployees) {
        if (emp.resignDate) {
          const key = this.getPeriodKey(emp.resignDate, periodGroup);
          if (!periodMap.has(key)) {
            periodMap.set(key, { opening: 0, hired: 0, resigned: 0, closing: 0 });
          }
          periodMap.get(key)!.resigned++;
        }
      }

      const periodKeys = Array.from(periodMap.keys()).sort();
      let prevClosing = totalOpening;

      for (const key of periodKeys) {
        const data = periodMap.get(key)!;
        data.opening = prevClosing;
        data.closing = data.opening + data.hired - data.resigned;
        prevClosing = data.closing;
      }

      periods = periodKeys.map((key) => ({
        period: key,
        ...periodMap.get(key)!,
        turnoverRate: periodMap.get(key)!.opening + periodMap.get(key)!.hired > 0
          ? Number(((periodMap.get(key)!.resigned / (periodMap.get(key)!.opening + periodMap.get(key)!.hired)) * 100).toFixed(1))
          : 0,
      }));
    }

    if (groupBy === 'department') {
      const deptMap = new Map<number, { departmentId: number; name: string; opening: number; hired: number; resigned: number; closing: number }>();

      for (const emp of openingEmployees) {
        const deptId = emp.departmentId;
        const deptName = emp.department?.name || '';
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { departmentId: deptId, name: deptName, opening: 0, hired: 0, resigned: 0, closing: 0 });
        }
        deptMap.get(deptId)!.opening++;
      }

      for (const emp of hiredEmployees) {
        const deptId = emp.departmentId;
        const deptName = emp.department?.name || '';
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { departmentId: deptId, name: deptName, opening: 0, hired: 0, resigned: 0, closing: 0 });
        }
        deptMap.get(deptId)!.hired++;
      }

      for (const emp of resignedEmployees) {
        const deptId = emp.departmentId;
        const deptName = emp.department?.name || '';
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { departmentId: deptId, name: deptName, opening: 0, hired: 0, resigned: 0, closing: 0 });
        }
        deptMap.get(deptId)!.resigned++;
      }

      byDepartment = Array.from(deptMap.values()).map((d) => ({
        ...d,
        closing: d.opening + d.hired - d.resigned,
        turnoverRate: d.opening + d.hired > 0
          ? Number(((d.resigned / (d.opening + d.hired)) * 100).toFixed(1))
          : 0,
      }));
    }

    const result = {
      periods,
      byDepartment,
      summary: {
        totalOpening,
        totalHired,
        totalResigned,
        totalClosing,
        turnoverRate,
      },
    };

    await this.setCache(cacheKey, result, REPORT_CACHE_TTL.hiringTrend);
    return result;
  }

  async getProbationPassRate(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'department' | GroupByPeriod;
    departmentId?: number;
    userId: number;
  }) {
    const cacheKey = this.generateCacheKey('probation-pass-rate', params);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, groupBy, departmentId, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodGroup = (groupBy === 'department' ? 'month' : groupBy || 'month') as GroupByPeriod;

    const baseWhere: any = {
      probationEndDate: { gte: start, lt: end },
    };

    if (scope.selfEmployeeId) {
      baseWhere.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      baseWhere.employee = { departmentId: { in: scope.ids } };
    }
    if (departmentId) {
      if (baseWhere.employee && typeof baseWhere.employee === 'object') {
        baseWhere.employee = { ...baseWhere.employee, departmentId };
      } else {
        baseWhere.employee = { departmentId };
      }
    }

    const probations = await this.prisma.probation.findMany({
      where: baseWhere,
      include: {
        employee: {
          select: {
            id: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    const totalDue = probations.length;
    const passed = probations.filter((p) => p.status === ProbationStatus.approved || p.status === ProbationStatus.completed).length;
    const failed = probations.filter((p) => p.status === ProbationStatus.rejected).length;
    const pending = probations.filter((p) =>
      p.status === ProbationStatus.draft || p.status === ProbationStatus.pending
    ).length;
    const passRate = totalDue > 0 ? Number(((passed / totalDue) * 100).toFixed(1)) : 0;

    let periods: { period: string; totalDue: number; passed: number; failed: number; pending: number; passRate: number }[] = [];
    let byDepartment: { departmentId: number; name: string; totalDue: number; passed: number; failed: number; pending: number; passRate: number }[] | undefined;

    if (!groupBy || groupBy !== 'department') {
      const periodMap = new Map<string, { totalDue: number; passed: number; failed: number; pending: number }>();

      for (const p of probations) {
        const key = this.getPeriodKey(p.probationEndDate, periodGroup);
        if (!periodMap.has(key)) {
          periodMap.set(key, { totalDue: 0, passed: 0, failed: 0, pending: 0 });
        }
        const stat = periodMap.get(key)!;
        stat.totalDue++;
        if (p.status === ProbationStatus.approved || p.status === ProbationStatus.completed) {
          stat.passed++;
        } else if (p.status === ProbationStatus.rejected) {
          stat.failed++;
        } else {
          stat.pending++;
        }
      }

      periods = Array.from(periodMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, data]) => ({
          period,
          ...data,
          passRate: data.totalDue > 0 ? Number(((data.passed / data.totalDue) * 100).toFixed(1)) : 0,
        }));
    }

    if (groupBy === 'department') {
      const deptMap = new Map<number, { departmentId: number; name: string; totalDue: number; passed: number; failed: number; pending: number }>();

      for (const p of probations) {
        const deptId = p.employee.departmentId;
        const deptName = p.employee.department?.name || '';
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { departmentId: deptId, name: deptName, totalDue: 0, passed: 0, failed: 0, pending: 0 });
        }
        const stat = deptMap.get(deptId)!;
        stat.totalDue++;
        if (p.status === ProbationStatus.approved || p.status === ProbationStatus.completed) {
          stat.passed++;
        } else if (p.status === ProbationStatus.rejected) {
          stat.failed++;
        } else {
          stat.pending++;
        }
      }

      byDepartment = Array.from(deptMap.values()).map((d) => ({
        ...d,
        passRate: d.totalDue > 0 ? Number(((d.passed / d.totalDue) * 100).toFixed(1)) : 0,
      }));
    }

    const result = {
      totalDue,
      passed,
      failed,
      pending,
      passRate,
      periods,
      byDepartment,
    };

    await this.setCache(cacheKey, result, REPORT_CACHE_TTL.probationPassRate);
    return result;
  }

  async getAttendanceAbnormal(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'department' | 'employee';
    departmentId?: number;
    userId: number;
  }) {
    const cacheKey = this.generateCacheKey('attendance-abnormal', params);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, groupBy, departmentId, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const baseWhere: any = {
      workDate: { gte: start, lte: end },
      status: { in: ['late', 'early', 'late_early', 'absent', 'half_absent', 'abnormal'] },
    };

    if (scope.selfEmployeeId) {
      baseWhere.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      baseWhere.employee = { departmentId: { in: scope.ids } };
    }
    if (departmentId) {
      if (baseWhere.employee && typeof baseWhere.employee === 'object') {
        baseWhere.employee = { ...baseWhere.employee, departmentId };
      } else {
        baseWhere.employee = { departmentId };
      }
    }

    const records = await this.prisma.attendanceDaily.findMany({
      where: baseWhere,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    let lateCount = 0;
    let earlyCount = 0;
    let lateEarlyCount = 0;
    let absentCount = 0;
    let halfAbsentCount = 0;
    let missingCardCount = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let totalAbsentMinutes = 0;

    for (const r of records) {
      if (r.status === 'late') {
        lateCount++;
        totalLateMinutes += r.lateMinutes;
      } else if (r.status === 'early') {
        earlyCount++;
        totalEarlyMinutes += r.earlyMinutes;
      } else if (r.status === 'late_early') {
        lateEarlyCount++;
        totalLateMinutes += r.lateMinutes;
        totalEarlyMinutes += r.earlyMinutes;
      } else if (r.status === 'absent') {
        absentCount++;
        totalAbsentMinutes += r.absentMinutes;
      } else if (r.status === 'half_absent') {
        halfAbsentCount++;
        totalAbsentMinutes += r.absentMinutes;
      } else if (r.status === 'abnormal') {
        missingCardCount++;
      }
    }

    const totalAbnormal = lateCount + earlyCount + lateEarlyCount + absentCount + halfAbsentCount + missingCardCount;
    const totalAbsentDays = Number((totalAbsentMinutes / 480).toFixed(2));
    const totalMissingCards = missingCardCount;

    let byDepartment: { departmentId: number; name: string; lateCount: number; earlyCount: number; lateEarlyCount: number; absentCount: number; halfAbsentCount: number; missingCardCount: number; totalAbnormal: number; totalLateMinutes: number; totalEarlyMinutes: number; totalAbsentDays: number; totalMissingCards: number }[] | undefined;
    let byEmployee: { employeeId: number; name: string; lateCount: number; earlyCount: number; lateEarlyCount: number; absentCount: number; halfAbsentCount: number; missingCardCount: number; totalAbnormal: number; totalLateMinutes: number; totalEarlyMinutes: number; totalAbsentDays: number; totalMissingCards: number }[] | undefined;

    if (groupBy === 'department') {
      const deptMap = new Map<number, { departmentId: number; name: string; lateCount: number; earlyCount: number; lateEarlyCount: number; absentCount: number; halfAbsentCount: number; missingCardCount: number; totalLateMinutes: number; totalEarlyMinutes: number; totalAbsentMinutes: number }>();

      for (const r of records) {
        const deptId = r.employee.departmentId;
        const deptName = r.employee.department?.name || '';
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { departmentId: deptId, name: deptName, lateCount: 0, earlyCount: 0, lateEarlyCount: 0, absentCount: 0, halfAbsentCount: 0, missingCardCount: 0, totalLateMinutes: 0, totalEarlyMinutes: 0, totalAbsentMinutes: 0 });
        }
        const stat = deptMap.get(deptId)!;
        if (r.status === 'late') {
          stat.lateCount++;
          stat.totalLateMinutes += r.lateMinutes;
        } else if (r.status === 'early') {
          stat.earlyCount++;
          stat.totalEarlyMinutes += r.earlyMinutes;
        } else if (r.status === 'late_early') {
          stat.lateEarlyCount++;
          stat.totalLateMinutes += r.lateMinutes;
          stat.totalEarlyMinutes += r.earlyMinutes;
        } else if (r.status === 'absent') {
          stat.absentCount++;
          stat.totalAbsentMinutes += r.absentMinutes;
        } else if (r.status === 'half_absent') {
          stat.halfAbsentCount++;
          stat.totalAbsentMinutes += r.absentMinutes;
        } else if (r.status === 'abnormal') {
          stat.missingCardCount++;
        }
      }

      byDepartment = Array.from(deptMap.values())
        .map((d) => ({
          departmentId: d.departmentId,
          name: d.name,
          lateCount: d.lateCount,
          earlyCount: d.earlyCount,
          lateEarlyCount: d.lateEarlyCount,
          absentCount: d.absentCount,
          halfAbsentCount: d.halfAbsentCount,
          missingCardCount: d.missingCardCount,
          totalAbnormal: d.lateCount + d.earlyCount + d.lateEarlyCount + d.absentCount + d.halfAbsentCount + d.missingCardCount,
          totalLateMinutes: d.totalLateMinutes,
          totalEarlyMinutes: d.totalEarlyMinutes,
          totalAbsentDays: Number((d.totalAbsentMinutes / 480).toFixed(2)),
          totalMissingCards: d.missingCardCount,
        }))
        .sort((a, b) => b.totalAbnormal - a.totalAbnormal);
    }

    if (groupBy === 'employee') {
      const empMap = new Map<number, { employeeId: number; name: string; lateCount: number; earlyCount: number; lateEarlyCount: number; absentCount: number; halfAbsentCount: number; missingCardCount: number; totalLateMinutes: number; totalEarlyMinutes: number; totalAbsentMinutes: number }>();

      for (const r of records) {
        const empId = r.employeeId;
        const empName = r.employee.name;
        if (!empMap.has(empId)) {
          empMap.set(empId, { employeeId: empId, name: empName, lateCount: 0, earlyCount: 0, lateEarlyCount: 0, absentCount: 0, halfAbsentCount: 0, missingCardCount: 0, totalLateMinutes: 0, totalEarlyMinutes: 0, totalAbsentMinutes: 0 });
        }
        const stat = empMap.get(empId)!;
        if (r.status === 'late') {
          stat.lateCount++;
          stat.totalLateMinutes += r.lateMinutes;
        } else if (r.status === 'early') {
          stat.earlyCount++;
          stat.totalEarlyMinutes += r.earlyMinutes;
        } else if (r.status === 'late_early') {
          stat.lateEarlyCount++;
          stat.totalLateMinutes += r.lateMinutes;
          stat.totalEarlyMinutes += r.earlyMinutes;
        } else if (r.status === 'absent') {
          stat.absentCount++;
          stat.totalAbsentMinutes += r.absentMinutes;
        } else if (r.status === 'half_absent') {
          stat.halfAbsentCount++;
          stat.totalAbsentMinutes += r.absentMinutes;
        } else if (r.status === 'abnormal') {
          stat.missingCardCount++;
        }
      }

      byEmployee = Array.from(empMap.values())
        .map((e) => ({
          employeeId: e.employeeId,
          name: e.name,
          lateCount: e.lateCount,
          earlyCount: e.earlyCount,
          lateEarlyCount: e.lateEarlyCount,
          absentCount: e.absentCount,
          halfAbsentCount: e.halfAbsentCount,
          missingCardCount: e.missingCardCount,
          totalAbnormal: e.lateCount + e.earlyCount + e.lateEarlyCount + e.absentCount + e.halfAbsentCount + e.missingCardCount,
          totalLateMinutes: e.totalLateMinutes,
          totalEarlyMinutes: e.totalEarlyMinutes,
          totalAbsentDays: Number((e.totalAbsentMinutes / 480).toFixed(2)),
          totalMissingCards: e.missingCardCount,
        }))
        .sort((a, b) => b.totalAbnormal - a.totalAbnormal);
    }

    const result = {
      summary: {
        lateCount,
        earlyCount,
        lateEarlyCount,
        absentCount,
        halfAbsentCount,
        missingCardCount,
        totalAbnormal,
        totalLateMinutes,
        totalEarlyMinutes,
        totalAbsentDays,
        totalMissingCards,
      },
      byDepartment,
      byEmployee,
    };

    await this.setCache(cacheKey, result, REPORT_CACHE_TTL.attendanceAbnormal);
    return result;
  }

  async getApprovalEfficiency(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'workflow' | 'department';
    departmentId?: number;
    userId: number;
  }) {
    const cacheKey = this.generateCacheKey('approval-efficiency', params);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, groupBy, departmentId, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const baseWhere: Prisma.ApprovalInstanceWhereInput = {
      createdAt: { gte: start, lte: end },
    };

    if (!scope.all && !scope.selfEmployeeId) {
      baseWhere.departmentId = { in: scope.ids };
    }
    if (departmentId) {
      baseWhere.departmentId = departmentId;
    }

    const instances = await this.prisma.approvalInstance.findMany({
      where: baseWhere,
      include: {
        workflow: {
          select: { id: true, name: true, code: true },
        },
        records: {
          orderBy: { order: 'asc' },
          select: { status: true, handledAt: true },
        },
      },
    });

    const getCompletedAt = (inst: typeof instances[0]): Date | null => {
      if (inst.status !== 'approved' && inst.status !== 'rejected') return null;
      const handledRecords = inst.records.filter((r) => r.handledAt !== null);
      if (handledRecords.length === 0) return inst.updatedAt;
      return handledRecords.reduce((latest, r) =>
        !latest || r.handledAt! > latest ? r.handledAt! : latest,
        null as Date | null,
      );
    };

    const totalInstances = instances.length;
    const approvedCount = instances.filter((i) => i.status === 'approved').length;
    const rejectedCount = instances.filter((i) => i.status === 'rejected').length;
    const completedCount = approvedCount + rejectedCount;
    const pendingCount = instances.filter((i) => i.status === 'pending').length;
    const approveRate = completedCount > 0 ? Number(((approvedCount / completedCount) * 100).toFixed(1)) : 0;

    let totalDurationHours = 0;
    for (const inst of instances) {
      const completedAt = getCompletedAt(inst);
      if (completedAt) {
        totalDurationHours += (completedAt.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60);
      }
    }
    const avgDurationHours = completedCount > 0
      ? Number((totalDurationHours / completedCount).toFixed(1))
      : 0;

    const now = new Date();
    const backlogCount = instances.filter((i) => {
      if (i.status !== 'pending') return false;
      const days = (now.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return days > 3;
    }).length;

    let byWorkflow: { workflowId: number; workflowName: string; totalInstances: number; approvedCount: number; rejectedCount: number; completedCount: number; pendingCount: number; approveRate: number; avgDurationHours: number; backlogCount: number }[] | undefined;
    let byDepartment: { departmentId: number | null; departmentName: string; totalInstances: number; approvedCount: number; rejectedCount: number; completedCount: number; pendingCount: number; approveRate: number; avgDurationHours: number; backlogCount: number }[] | undefined;

    if (groupBy === 'workflow') {
      const wfMap = new Map<number, { workflowId: number; workflowName: string; totalInstances: number; approvedCount: number; rejectedCount: number; pendingCount: number; totalDurationHours: number; backlogCount: number }>();

      for (const inst of instances) {
        const wfId = inst.workflowId;
        const wfName = inst.workflow?.name || '';
        if (!wfMap.has(wfId)) {
          wfMap.set(wfId, { workflowId: wfId, workflowName: wfName, totalInstances: 0, approvedCount: 0, rejectedCount: 0, pendingCount: 0, totalDurationHours: 0, backlogCount: 0 });
        }
        const stat = wfMap.get(wfId)!;
        stat.totalInstances++;
        if (inst.status === 'approved') {
          stat.approvedCount++;
          const completedAt = getCompletedAt(inst);
          if (completedAt) {
            stat.totalDurationHours += (completedAt.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60);
          }
        } else if (inst.status === 'rejected') {
          stat.rejectedCount++;
          const completedAt = getCompletedAt(inst);
          if (completedAt) {
            stat.totalDurationHours += (completedAt.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60);
          }
        } else if (inst.status === 'pending') {
          stat.pendingCount++;
          const days = (now.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (days > 3) stat.backlogCount++;
        }
      }

      byWorkflow = Array.from(wfMap.values()).map((w) => {
        const completed = w.approvedCount + w.rejectedCount;
        return {
          workflowId: w.workflowId,
          workflowName: w.workflowName,
          totalInstances: w.totalInstances,
          approvedCount: w.approvedCount,
          rejectedCount: w.rejectedCount,
          completedCount: completed,
          pendingCount: w.pendingCount,
          approveRate: completed > 0 ? Number(((w.approvedCount / completed) * 100).toFixed(1)) : 0,
          avgDurationHours: completed > 0 ? Number((w.totalDurationHours / completed).toFixed(1)) : 0,
          backlogCount: w.backlogCount,
        };
      });
    }

    if (groupBy === 'department') {
      const deptMap = new Map<string, { departmentId: number | null; departmentName: string; totalInstances: number; approvedCount: number; rejectedCount: number; pendingCount: number; totalDurationHours: number; backlogCount: number }>();
      const deptIds = [...new Set(instances.map((i) => i.departmentId).filter(Boolean))] as number[];
      const depts = deptIds.length > 0 ? await this.prisma.department.findMany({
        where: { id: { in: deptIds } },
        select: { id: true, name: true },
      }) : [];
      const deptNameMap = new Map<number, string>(depts.map((d: { id: number; name: string }) => [d.id, d.name]));

      for (const inst of instances) {
        const deptId = inst.departmentId;
        const key = deptId ? String(deptId) : 'null';
        const deptName = deptId ? deptNameMap.get(deptId) || '' : '未分配部门';
        if (!deptMap.has(key)) {
          deptMap.set(key, { departmentId: deptId || null, departmentName: deptName, totalInstances: 0, approvedCount: 0, rejectedCount: 0, pendingCount: 0, totalDurationHours: 0, backlogCount: 0 });
        }
        const stat = deptMap.get(key)!;
        stat.totalInstances++;
        if (inst.status === 'approved') {
          stat.approvedCount++;
          const completedAt = getCompletedAt(inst);
          if (completedAt) {
            stat.totalDurationHours += (completedAt.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60);
          }
        } else if (inst.status === 'rejected') {
          stat.rejectedCount++;
          const completedAt = getCompletedAt(inst);
          if (completedAt) {
            stat.totalDurationHours += (completedAt.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60);
          }
        } else if (inst.status === 'pending') {
          stat.pendingCount++;
          const days = (now.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (days > 3) stat.backlogCount++;
        }
      }

      byDepartment = Array.from(deptMap.values()).map((d) => {
        const completed = d.approvedCount + d.rejectedCount;
        return {
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          totalInstances: d.totalInstances,
          approvedCount: d.approvedCount,
          rejectedCount: d.rejectedCount,
          completedCount: completed,
          pendingCount: d.pendingCount,
          approveRate: completed > 0 ? Number(((d.approvedCount / completed) * 100).toFixed(1)) : 0,
          avgDurationHours: completed > 0 ? Number((d.totalDurationHours / completed).toFixed(1)) : 0,
          backlogCount: d.backlogCount,
        };
      });
    }

    const result = {
      summary: {
        totalInstances,
        approvedCount,
        rejectedCount,
        completedCount,
        pendingCount,
        approveRate,
        avgDurationHours,
        backlogCount,
      },
      byWorkflow,
      byDepartment,
    };

    await this.setCache(cacheKey, result, REPORT_CACHE_TTL.approvalEfficiency);
    return result;
  }

  exportAttendanceMonthlyCsv(params: { month: string; userId: number; departmentId?: number }): Promise<string> {
    return this.attendanceMonthly(params).then((data) => {
      const header = '部门,员工数,出勤天数,迟到次数,早退次数,旷工天数,加班时长';
      const rows = data.departments.map((d: any) =>
        [d.name, d.employeeCount, d.totalWorkDays, d.totalLateCount, d.totalEarlyCount, d.totalAbsentDays, d.totalOvertimeHours].join(','),
      );
      return [header, ...rows].join('\n');
    });
  }

  exportLaborCostCsv(params: { month: string; userId: number; departmentId?: number }): Promise<string> {
    return this.laborCost(params).then((data) => {
      const header = '部门,员工数,基本工资,加班费,扣款合计,薪资成本,招聘成本,培训成本,总成本';
      const rows = data.departments.map((d: any) =>
        [d.name, d.employeeCount, d.totalBaseSalary, d.totalOvertimePay, d.totalDeduction, d.totalSalaryAmount, d.totalRecruitmentCost, d.totalTrainingCost, d.totalAmount].join(','),
      );
      return [header, ...rows].join('\n');
    });
  }

  async exportAttendanceMonthlyXlsx(params: { month: string; userId: number; departmentId?: number }): Promise<Buffer> {
    const data = await this.attendanceMonthly(params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('考勤月报');
    ws.columns = [
      { header: '部门', key: 'name', width: 20 },
      { header: '员工数', key: 'employeeCount', width: 10 },
      { header: '出勤天数', key: 'totalWorkDays', width: 12 },
      { header: '迟到次数', key: 'totalLateCount', width: 12 },
      { header: '早退次数', key: 'totalEarlyCount', width: 12 },
      { header: '旷工天数', key: 'totalAbsentDays', width: 12 },
      { header: '加班时长', key: 'totalOvertimeHours', width: 12 },
    ];
    for (const d of data.departments) {
      ws.addRow(d);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as any);
  }

  async exportLaborCostXlsx(params: { month: string; userId: number; departmentId?: number }): Promise<Buffer> {
    const data = await this.laborCost(params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('人力成本');
    ws.columns = [
      { header: '部门', key: 'name', width: 20 },
      { header: '员工数', key: 'employeeCount', width: 10 },
      { header: '基本工资', key: 'totalBaseSalary', width: 14 },
      { header: '加班费', key: 'totalOvertimePay', width: 12 },
      { header: '扣款合计', key: 'totalDeduction', width: 12 },
      { header: '薪资成本', key: 'totalSalaryAmount', width: 14 },
      { header: '招聘成本', key: 'totalRecruitmentCost', width: 14 },
      { header: '培训成本', key: 'totalTrainingCost', width: 14 },
      { header: '总成本', key: 'totalAmount', width: 14 },
    ];
    for (const d of data.departments) {
      ws.addRow(d);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as any);
  }

  private getExportDir() {
    const dir = join(process.cwd(), 'exports');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  async createExportTask(params: {
    type: string;
    format: string;
    month?: string;
    userId: number;
  }) {
    const { type, format, month, userId } = params;

    if (!type || !format) {
      throw new BadRequestException({ code: 4001, message: '缺少必要参数' });
    }

    const validTypes = ['attendance-monthly', 'labor-cost'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException({ code: 4002, message: '不支持的导出类型' });
    }

    const validFormats = ['csv', 'xlsx'];
    if (!validFormats.includes(format)) {
      throw new BadRequestException({ code: 4003, message: '不支持的导出格式' });
    }

    const task = await this.prisma.exportTask.create({
      data: {
        type,
        format,
        month: month || null,
        status: ExportTaskStatus.pending,
        createdBy: userId,
      },
    });

    setImmediate(() => this.processExportTask(task.id, userId).catch(() => {}));

    return {
      taskId: task.id,
      status: task.status,
    };
  }

  private async processExportTask(taskId: number, userId: number, isRetry = false) {
    try {
      const updateData: any = { status: ExportTaskStatus.processing };
      if (isRetry) {
        updateData.retryCount = { increment: 1 };
      }
      await this.prisma.exportTask.update({
        where: { id: taskId },
        data: updateData,
      });

      const task = await this.prisma.exportTask.findUnique({ where: { id: taskId } });
      if (!task) return;

      const month = task.month || '';
      let buffer: Buffer;
      let fileName: string;

      if (task.type === 'attendance-monthly' && task.format === 'csv') {
        const csv = await this.exportAttendanceMonthlyCsv({ month, userId });
        buffer = Buffer.from(csv, 'utf-8');
        fileName = `attendance-monthly-${month}.csv`;
      } else if (task.type === 'attendance-monthly' && task.format === 'xlsx') {
        buffer = await this.exportAttendanceMonthlyXlsx({ month, userId });
        fileName = `attendance-monthly-${month}.xlsx`;
      } else if (task.type === 'labor-cost' && task.format === 'csv') {
        const csv = await this.exportLaborCostCsv({ month, userId });
        buffer = Buffer.from(csv, 'utf-8');
        fileName = `labor-cost-${month}.csv`;
      } else if (task.type === 'labor-cost' && task.format === 'xlsx') {
        buffer = await this.exportLaborCostXlsx({ month, userId });
        fileName = `labor-cost-${month}.xlsx`;
      } else {
        throw new BadRequestException({ code: 5008, message: '不支持的报表类型' });
      }

      const dir = this.getExportDir();
      const filePath = join(dir, `${taskId}-${fileName}`);
      writeFileSync(filePath, buffer);

      const downloadUrl = `/api/v1/reports/export/${taskId}/download`;

      await this.prisma.exportTask.update({
        where: { id: taskId },
        data: {
          status: ExportTaskStatus.completed,
          fileName,
          filePath,
          fileSize: buffer.length,
          downloadUrl,
        },
      });
    } catch (e: any) {
      const task = await this.prisma.exportTask.findUnique({ where: { id: taskId } });
      if (!task) return;

      const currentRetryCount = task.retryCount || 0;
      const maxRetries = task.maxRetries || 3;

      if (currentRetryCount < maxRetries) {
        this.logger.log(`导出任务 ${taskId} 失败，正在自动重试 (${currentRetryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          this.processExportTask(taskId, userId, true).catch(() => {});
        }, 2000 * (currentRetryCount + 1));
        return;
      }

      await this.prisma.exportTask.update({
        where: { id: taskId },
        data: {
          status: ExportTaskStatus.failed,
          errorMsg: e.message || 'export failed',
        },
      }).catch(() => {});
    }
  }

  async retryTask(taskId: number, userId: number) {
    const task = await this.prisma.exportTask.findUnique({ where: { id: taskId } });
    if (!task || task.createdBy !== userId) {
      throw new BadRequestException({ code: 4004, message: '任务不存在' });
    }
    if (task.status !== ExportTaskStatus.failed) {
      throw new BadRequestException({ code: 4006, message: '只有失败的任务才能重试' });
    }

    await this.prisma.exportTask.update({
      where: { id: taskId },
      data: {
        status: ExportTaskStatus.pending,
        errorMsg: null,
        fileName: null,
        filePath: null,
        fileSize: null,
        downloadUrl: null,
      },
    });

    setImmediate(() => this.processExportTask(taskId, userId, true).catch(() => {}));

    return {
      taskId: task.id,
      status: ExportTaskStatus.pending,
      retryCount: task.retryCount + 1,
    };
  }

  async getTaskStatus(taskId: number, userId: number) {
    const task = await this.prisma.exportTask.findUnique({ where: { id: taskId } });
    if (!task || task.createdBy !== userId) {
      throw new BadRequestException({ code: 4004, message: '任务不存在' });
    }
    return {
      taskId: task.id,
      status: task.status,
      fileName: task.fileName,
      downloadUrl: task.downloadUrl,
      fileSize: task.fileSize,
      errorMsg: task.errorMsg,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      createdAt: task.createdAt,
    };
  }

  async listTasks(userId: number) {
    const [list, total] = await Promise.all([
      this.prisma.exportTask.findMany({
        where: { createdBy: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          format: true,
          month: true,
          status: true,
          fileName: true,
          downloadUrl: true,
          retryCount: true,
          maxRetries: true,
          errorMsg: true,
          createdAt: true,
        },
      }),
      this.prisma.exportTask.count({ where: { createdBy: userId } }),
    ]);
    return { list, total };
  }

  async getTaskFilePath(taskId: number, userId: number) {
    const task = await this.prisma.exportTask.findUnique({ where: { id: taskId } });
    if (!task || task.createdBy !== userId) {
      throw new BadRequestException({ code: 4004, message: '任务不存在' });
    }
    if (task.status !== ExportTaskStatus.completed || !task.filePath) {
      throw new BadRequestException({ code: 4005, message: '文件未就绪' });
    }
    return { filePath: task.filePath, fileName: task.fileName! };
  }
}
