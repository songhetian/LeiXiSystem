import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma, ExportTaskStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
  ) {}

  async attendanceMonthly(params: { month: string; userId: number }) {
    const { month, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.AttendanceMonthlyWhereInput = { month };
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
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

  async laborCost(params: { month: string; userId: number }) {
    const { month, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const run = await this.prisma.payrollRun.findUnique({
      where: { month },
    });
    if (!run) {
      return {
        summary: { totalEmployees: 0, totalBaseSalary: '0', totalOvertimePay: '0', totalDeduction: '0', totalAmount: '0' },
        departments: [],
      };
    }

    const where: Prisma.PayrollDetailWhereInput = { runId: run.id };
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }

    const details = await this.prisma.payrollDetail.findMany({
      where,
      include: {
        employee: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
    });

    type DeptStat = {
      id: number;
      name: string;
      employeeCount: Set<number>;
      totalBaseSalary: Prisma.Decimal;
      totalOvertimePay: Prisma.Decimal;
      totalDeduction: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
    };

    const deptMap = new Map<number, DeptStat>();
    const allEmployees = new Set<number>();
    let totalBaseSalary = new Prisma.Decimal(0);
    let totalOvertimePay = new Prisma.Decimal(0);
    let totalDeduction = new Prisma.Decimal(0);
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
      stat.totalAmount = stat.totalAmount.plus(amt);
      totalAmount = totalAmount.plus(amt);
    }

    const departments = Array.from(deptMap.values()).map((d) => ({
      id: d.id,
      name: d.name,
      employeeCount: d.employeeCount.size,
      totalBaseSalary: d.totalBaseSalary.toString(),
      totalOvertimePay: d.totalOvertimePay.toString(),
      totalDeduction: d.totalDeduction.toString(),
      totalAmount: d.totalAmount.toString(),
    }));

    return {
      summary: {
        totalEmployees: allEmployees.size,
        totalBaseSalary: totalBaseSalary.toString(),
        totalOvertimePay: totalOvertimePay.toString(),
        totalDeduction: totalDeduction.toString(),
        totalAmount: totalAmount.toString(),
      },
      departments,
    };
  }

  exportAttendanceMonthlyCsv(params: { month: string; userId: number }): Promise<string> {
    return this.attendanceMonthly(params).then((data) => {
      const header = '部门,员工数,出勤天数,迟到次数,早退次数,旷工天数,加班时长';
      const rows = data.departments.map((d) =>
        [d.name, d.employeeCount, d.totalWorkDays, d.totalLateCount, d.totalEarlyCount, d.totalAbsentDays, d.totalOvertimeHours].join(','),
      );
      return [header, ...rows].join('\n');
    });
  }

  exportLaborCostCsv(params: { month: string; userId: number }): Promise<string> {
    return this.laborCost(params).then((data) => {
      const header = '部门,员工数,基本工资,加班费,扣款合计,总金额';
      const rows = data.departments.map((d) =>
        [d.name, d.employeeCount, d.totalBaseSalary, d.totalOvertimePay, d.totalDeduction, d.totalAmount].join(','),
      );
      return [header, ...rows].join('\n');
    });
  }

  async exportAttendanceMonthlyXlsx(params: { month: string; userId: number }): Promise<Buffer> {
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

  async exportLaborCostXlsx(params: { month: string; userId: number }): Promise<Buffer> {
    const data = await this.laborCost(params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('人力成本');
    ws.columns = [
      { header: '部门', key: 'name', width: 20 },
      { header: '员工数', key: 'employeeCount', width: 10 },
      { header: '基本工资', key: 'totalBaseSalary', width: 14 },
      { header: '加班费', key: 'totalOvertimePay', width: 12 },
      { header: '扣款合计', key: 'totalDeduction', width: 12 },
      { header: '总金额', key: 'totalAmount', width: 14 },
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

  private async processExportTask(taskId: number, userId: number) {
    try {
      await this.prisma.exportTask.update({
        where: { id: taskId },
        data: { status: ExportTaskStatus.processing },
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
        throw new Error('unsupported');
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
      await this.prisma.exportTask.update({
        where: { id: taskId },
        data: {
          status: ExportTaskStatus.failed,
          errorMsg: e.message || 'export failed',
        },
      }).catch(() => {});
    }
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
