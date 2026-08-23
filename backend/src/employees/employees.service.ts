import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Employee, EmployeeStatus } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import * as ExcelJS from 'exceljs';

// 员工聚合根服务（S03）：CRUD + 离职状态机 + 部门数据隔离（ADR-0010，经 DataScopeService 统一注入）
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async create(dto: any) {
    const exists = await this.prisma.employee.findUnique({ where: { employeeNo: dto.employeeNo } });
    if (exists) throw new ConflictException({ code: ERROR_CODES.EMPLOYEE_NO_EXISTS });
    if (dto.salary !== undefined && Number(dto.salary) < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '员工薪资不能为负' });
    }
    return this.prisma.employee.create({
      data: { ...dto, hireDate: new Date(dto.hireDate) },
    });
  }

  async getByUserId(userId: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      include: {
        department: { select: { id: true, name: true, parentId: true } },
        position: { select: { id: true, name: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND });
    }
    return employee;
  }

  async getMyInfo(userId: number) {
    return this.getByUserId(userId);
  }

  async updateMyProfile(
    userId: number,
    data: {
      phone?: string;
      address?: string;
      email?: string;
      bankAccount?: string;
      bankName?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
    },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException({ code: 1004, message: '未找到员工档案' });
    }

    const ALLOWED_FIELDS = [
      'phone',
      'email',
      'address',
      'emergencyContact',
      'emergencyPhone',
      'bankAccount',
      'bankName',
    ];

    const updateData: any = {};
    for (const field of ALLOWED_FIELDS) {
      if ((data as any)[field] !== undefined) {
        updateData[field] = (data as any)[field];
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: employee.id },
        data: updateData,
        include: {
          department: { select: { id: true, name: true, parentId: true } },
          position: { select: { id: true, name: true } },
        },
      });
      await this.recordChangeLogsWithTx(tx, employee.id, employee, updateData, userId, 'self_update');
      return result;
    });

    return updated;
  }

  async list(userId: number, query: { page: number; pageSize: number; keyword?: string }) {
    const scope = await this.visibleScope(userId);
    const where: any = {};
    if (scope.selfEmployeeId) {
      where.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }
    if (query.keyword) {
      where.OR = [
        { employeeNo: { contains: query.keyword } },
        { name: { contains: query.keyword } },
      ];
    }
    const [list, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: {
          id: true,
          employeeNo: true,
          name: true,
          departmentId: true,
          positionId: true,
          hireDate: true,
          resignDate: true,
          phone: true,
          status: true,
          rating: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: { id: true, name: true, parentId: true },
          },
          position: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(userId: number, id: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { department: true, position: true },
    });
    if (!employee) throw new NotFoundException({ code: 1002, message: '员工不存在' });
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: 5003, message: '无权限访问该数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      // ADR-0010：员工存在但不在调用者数据范围内 → 行级越权，返回 5003（非 1002）
      throw new ForbiddenException({ code: 5003, message: '无权限访问该数据' });
    }
    return employee;
  }

  async update(id: number, dto: any, userId: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.getActive(id);
    // IDOR fix: verify the employee is in the caller's data scope
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权操作其他员工的数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: 4030, message: '无权操作其他员工的数据' });
    }
    if (dto.salary !== undefined && Number(dto.salary) < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '员工薪资不能为负' });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({ where: { id: employee.id }, data: dto });
      await this.recordChangeLogsWithTx(tx, employee.id, employee, dto, userId, 'admin_update');
      return result;
    });
    return updated;
  }

  async resign(id: number, userId: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.getActive(id);
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权操作其他员工的数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: 4030, message: '无权操作其他员工的数据' });
    }
    const updateData = { status: EmployeeStatus.resigned, resignDate: new Date() };
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: employee.id },
        data: updateData,
      });
      await this.recordChangeLogsWithTx(tx, employee.id, employee, updateData, userId, 'resign');
      return result;
    });
    return updated;
  }

  async restore(id: number, userId: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND, message: '员工不存在' });
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权操作其他员工的数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: 4030, message: '无权操作其他员工的数据' });
    }
    if (employee.status !== EmployeeStatus.resigned) {
      throw new ConflictException({ code: ERROR_CODES.EMPLOYEE_NOT_RESIGNED, message: '员工未离职，不可恢复' });
    }
    const updateData = { status: EmployeeStatus.active, resignDate: null };
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: employee.id },
        data: updateData,
      });
      await this.recordChangeLogsWithTx(tx, employee.id, employee, updateData, userId, 'restore');
      return result;
    });
    return updated;
  }

  // 离职状态机：仅 active 可修改/离职
  private async getActive(id: number): Promise<Employee> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException({ code: 1002, message: '员工不存在' });
    if (employee.status === EmployeeStatus.resigned) {
      throw new ConflictException({ code: 1004, message: '员工已离职，不可操作' });
    }
    return employee;
  }

  // ADR-0010：可见部门范围（统一经 DataScopeService）
  private async visibleScope(userId: number) {
    return this.dataScope.visibleScope(userId);
  }

  async getChangeLogs(userId: number, employeeId: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException({ code: 1002, message: '员工不存在' });
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: 5003, message: '无权限访问该数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: 5003, message: '无权限访问该数据' });
    }
    return this.prisma.employeeChangeLog.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recordChangeLogs(
    employeeId: number,
    oldEmployee: Employee,
    updateData: Record<string, any>,
    changedBy: number,
    changeType: string,
  ) {
    const changeLogs = this.buildChangeLogs(employeeId, oldEmployee, updateData, changedBy, changeType);
    if (changeLogs.length > 0) {
      await this.prisma.employeeChangeLog.createMany({ data: changeLogs });
    }
  }

  private async recordChangeLogsWithTx(
    tx: any,
    employeeId: number,
    oldEmployee: Employee,
    updateData: Record<string, any>,
    changedBy: number,
    changeType: string,
  ) {
    const changeLogs = this.buildChangeLogs(employeeId, oldEmployee, updateData, changedBy, changeType);
    if (changeLogs.length > 0) {
      await tx.employeeChangeLog.createMany({ data: changeLogs });
    }
  }

  private buildChangeLogs(
    employeeId: number,
    oldEmployee: Employee,
    updateData: Record<string, any>,
    changedBy: number,
    changeType: string,
  ): Array<{
    employeeId: number;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: number;
    changeType: string;
  }> {
    const changeLogs: Array<{
      employeeId: number;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: number;
      changeType: string;
    }> = [];

    for (const [field, newValue] of Object.entries(updateData)) {
      if (newValue === undefined) continue;
      const oldValue = (oldEmployee as any)[field];
      const oldStr = this.valueToString(oldValue);
      const newStr = this.valueToString(newValue);
      if (oldStr !== newStr) {
        changeLogs.push({
          employeeId,
          field,
          oldValue: oldStr,
          newValue: newStr,
          changedBy,
          changeType,
        });
      }
    }

    return changeLogs;
  }

  private valueToString(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  async exportExcel(userId: number): Promise<Buffer> {
    const scope = await this.visibleScope(userId);
    const where: any = { status: EmployeeStatus.active };
    if (scope.selfEmployeeId) {
      where.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }
    const employees = await this.prisma.employee.findMany({
      where,
      include: { department: true, position: true },
      orderBy: { id: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('员工列表');
    sheet.columns = [
      { header: '工号', key: 'employeeNo', width: 15 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '部门', key: 'department', width: 20 },
      { header: '职位', key: 'position', width: 15 },
      { header: '手机号', key: 'phone', width: 15 },
      { header: '入职日期', key: 'hireDate', width: 15 },
      { header: '状态', key: 'status', width: 10 },
    ];
    employees.forEach((e) => {
      sheet.addRow({
        employeeNo: e.employeeNo,
        name: e.name,
        department: e.department?.name || '',
        position: e.position?.name || '',
        phone: e.phone || '',
        hireDate: e.hireDate ? e.hireDate.toISOString().split('T')[0] : '',
        status: e.status === EmployeeStatus.active ? '在职' : '离职',
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }

  async importExcel(userId: number, buffer: Buffer): Promise<{ success: number; failed: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException({ code: 4000, message: 'Excel 为空' });

    const departments = await this.prisma.department.findMany();
    const positions = await this.prisma.position.findMany();
    const deptMap = new Map(departments.map((d) => [d.name, d.id]));
    const posMap = new Map(positions.map((p) => [p.name, p.id]));

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const rows = sheet.getRows(2, sheet.rowCount - 1) || [];
    for (const row of rows) {
      const employeeNo = String(row.getCell(1).value || '').trim();
      const name = String(row.getCell(2).value || '').trim();
      const deptName = String(row.getCell(3).value || '').trim();
      const posName = String(row.getCell(4).value || '').trim();
      const phone = String(row.getCell(5).value || '').trim();
      const hireDateStr = String(row.getCell(6).value || '').trim();

      if (!employeeNo || !name) {
        failed++;
        errors.push(`第 ${row.number} 行：工号和姓名必填`);
        continue;
      }
      const departmentId = deptMap.get(deptName);
      if (!departmentId) {
        failed++;
        errors.push(`第 ${row.number} 行：部门「${deptName}」不存在`);
        continue;
      }
      const positionId = posMap.get(posName) || undefined;
      const hireDate = hireDateStr ? new Date(hireDateStr) : new Date();

      try {
        await this.prisma.employee.create({
          data: {
            employeeNo,
            name,
            departmentId,
            positionId,
            phone: phone || null,
            hireDate,
            status: EmployeeStatus.active,
          },
        });
        success++;
      } catch (e: any) {
        failed++;
        errors.push(`第 ${row.number} 行：${e.message || '导入失败'}`);
      }
    }
    return { success, failed, errors };
  }

  async generateImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('员工导入模板');

    sheet.columns = [
      { header: '工号', key: 'employeeNo', width: 15 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '部门', key: 'department', width: 20 },
      { header: '职位', key: 'position', width: 15 },
      { header: '手机号', key: 'phone', width: 15 },
      { header: '入职日期', key: 'hireDate', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF7' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const exampleRow = sheet.addRow({
      employeeNo: 'E001',
      name: '张三',
      department: '技术部',
      position: '工程师',
      phone: '13800138000',
      hireDate: '2026-01-01',
    });
    exampleRow.font = { color: { argb: 'FF999999' }, italic: true };
    exampleRow.alignment = { vertical: 'middle' };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }
}
