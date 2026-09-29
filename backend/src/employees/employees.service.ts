import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Employee, EmployeeStatus, Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { beijingNow } from '../common/date.util';
import * as ExcelJS from 'exceljs';

// 员工聚合根服务（S03）：CRUD + 离职状态机 + 部门数据隔离（ADR-0010，经 DataScopeService 统一注入）
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  // 薪资生效月：默认次月（发薪「本月发上月」，8 月改薪 → 9 月计薪月生效 → 10 月发放）
  // 必须按北京时间取「当前年月」：UTC 容器在北京时间每月 1 日 00:00~08:00 仍停在上月末，
  // 用本地时区 getter 会把生效月算成当月，导致提前一个月生效发薪。
  private nextEffectiveMonth(date = new Date()): string {
    const { year, month } = beijingNow(date);
    // month 为 1-based 当前月，其 0-based 索引正好等于「下个月」的月份索引；
    // 以本地时区构造再以本地 getter 读回，属自洽往返，与服务器时区无关。
    const d = new Date(year, month, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  }

  /**
   * 员工工号自动生成（对齐老项目 EMP + 递增 4 位序号）。
   * 查询现有 EMP 前缀工号的最大序号，新增取 max+1；初始为 EMP0001。
   */
  private async generateEmployeeNo(): Promise<string> {
    const existing = await this.prisma.employee.findMany({
      where: { employeeNo: { startsWith: 'EMP' } },
      select: { employeeNo: true },
    });
    let max = 0;
    for (const e of existing) {
      const m = /^EMP(\d+)$/.exec(e.employeeNo);
      if (m) {
        const n = Number(m[1]);
        if (n > max) max = n;
      }
    }
    return `EMP${String(max + 1).padStart(4, '0')}`;
  }

  async create(dto: any) {
    const explicitNo = dto.employeeNo?.trim();
    const { employeeNo: _ignored, tagIds, ...rest } = dto;
    if (dto.salary !== undefined && Number(dto.salary) < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '员工薪资不能为负' });
    }

    // 自动生成工号在并发下可能命中唯一索引冲突（P2002），重新生成并重试；显式传入的工号冲突则直接抛出。
    let employeeNo = explicitNo || (await this.generateEmployeeNo());
    for (let attempt = 0; attempt < 3; attempt++) {
      const exists = await this.prisma.employee.findUnique({ where: { employeeNo } });
      if (exists) {
        if (explicitNo) throw new ConflictException({ code: ERROR_CODES.EMPLOYEE_NO_EXISTS });
        employeeNo = await this.generateEmployeeNo();
        continue;
      }
      try {
        return await this.prisma.employee.create({
          data: {
            ...rest,
            employeeNo,
            hireDate: new Date(dto.hireDate),
            // 标签多对多：嵌套创建员工-标签关联
            ...(Array.isArray(tagIds) && tagIds.length
              ? { tagRelations: { create: (tagIds as number[]).map((tagId) => ({ tagId })) } }
              : {}),
          },
        });
      } catch (err: any) {
        if (explicitNo || err?.code !== 'P2002') throw err;
        employeeNo = await this.generateEmployeeNo();
      }
    }
    throw new ConflictException({ code: ERROR_CODES.EMPLOYEE_NO_EXISTS });
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
      throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND, message: '未找到员工档案' });
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

  async list(userId: number, query: {
    page: number;
    pageSize: number;
    keyword?: string;
    departmentId?: number | string;
    positionId?: number | string;
    status?: string;
    rating?: number | string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const scope = await this.visibleScope(userId);
    const where: any = {};
    if (scope.selfEmployeeId) {
      where.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }
    // 多维度过滤：与数据范围叠加（AND）；部门过滤越出可视范围时置空查询结果，杜绝越权
    if (query.departmentId !== undefined && query.departmentId !== null && query.departmentId !== '') {
      const fid = Number(query.departmentId);
      if (scope.all || scope.ids.includes(fid)) {
        where.departmentId = fid;
      } else if (!scope.all) {
        where.departmentId = -1;
      }
    }
    if (query.positionId !== undefined && query.positionId !== null && query.positionId !== '') {
      where.positionId = Number(query.positionId);
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.rating !== undefined && query.rating !== null && query.rating !== '') {
      where.rating = Number(query.rating);
    }
    // 入职时间范围筛选（dateFrom/dateTo，支持单边）
    if (query.dateFrom || query.dateTo) {
      const range: any = {};
      if (query.dateFrom) range.gte = new Date(query.dateFrom);
      if (query.dateTo) range.lte = new Date(query.dateTo);
      where.hireDate = range;
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
          tagRelations: {
            select: { tag: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: { id: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    // 契约对齐：于嵌套 department/position 之上派生扁平化 name，避免前端读取 undefined
    const formattedList = list.map((emp) => ({
      ...emp,
      departmentName: emp.department?.name || '',
      positionName: emp.position?.name || '',
      tags: emp.tagRelations?.map((r) => r.tag) ?? [],
    }));
    return { list: formattedList, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(userId: number, id: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: true,
        tagRelations: { include: { tag: true } },
      },
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
    return { ...employee, tags: employee.tagRelations?.map((r) => r.tag) ?? [] };
  }

  async update(id: number, dto: any, userId: number) {
    const scope = await this.visibleScope(userId);
    const employee = await this.getActive(id);
    // IDOR fix: verify the employee is in the caller's data scope
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作其他员工的数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作其他员工的数据' });
    }
    if (dto.salary !== undefined && Number(dto.salary) < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '员工薪资不能为负' });
    }
    // tagIds 不进 employee.update 标量字段，事务内单独重建关联
    // effectiveMonth：薪资生效月，默认次月；不参与 employee.update 标量字段
    const { tagIds, effectiveMonth, ...updateDto } = dto;
    // 判断薪资是否发生变化（需写入薪资调整留痕）
    const salaryChanged =
      updateDto.salary !== undefined &&
      Number(updateDto.salary) !== Number(employee.salary);
    const effMonth = effectiveMonth ?? this.nextEffectiveMonth();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({ where: { id: employee.id }, data: updateDto });
      // 薪资调整留痕：改薪写一条带生效月；8 月改薪 → 9 月计薪月生效 → 10 月发放
      if (salaryChanged) {
        await tx.salaryAdjustment.create({
          data: {
            employeeId: employee.id,
            amount: Number(updateDto.salary),
            effectiveMonth: effMonth,
            remark: effectiveMonth
              ? `指定生效月 ${effMonth}`
              : `默认次月生效（${effMonth}）`,
            changedBy: userId,
          },
        });
      }
      // 标签多对多：未传 tagIds 时保持原样；传入时全量清空重建
      if (Array.isArray(tagIds)) {
        await tx.employeeTagRelation.deleteMany({ where: { employeeId: employee.id } });
        if (tagIds.length > 0) {
          await tx.employeeTagRelation.createMany({
            data: (tagIds as number[]).map((tagId) => ({ employeeId: employee.id, tagId })),
          });
        }
      }
      await this.recordChangeLogsWithTx(tx, employee.id, employee, updateDto, userId, 'admin_update');
      return result;
    });
    return updated;
  }

  async resign(
    id: number,
    userId: number,
    data: { resignDate?: string; reason?: string } = {},
  ) {
    const scope = await this.visibleScope(userId);
    const employee = await this.getActive(id);
    if (scope.selfEmployeeId) {
      if (employee.id !== scope.selfEmployeeId) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作其他员工的数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作其他员工的数据' });
    }
    const resignDate = data.resignDate ? new Date(data.resignDate) : new Date();
    const dbData = {
      status: EmployeeStatus.resigned,
      resignDate,
    };
    // 离职原因记入变更流水（字段名 resignReason），便于履历查看离职缘由
    const resignReason = data.reason?.trim();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: employee.id },
        data: dbData,
      });
      const extraLogs = resignReason
        ? [{
            employeeId: employee.id,
            field: 'resignReason',
            oldValue: null,
            newValue: resignReason,
            changedBy: userId,
            changeType: 'resign',
          }]
        : [];
      await this.recordChangeLogsWithTx(tx, employee.id, employee, dbData, userId, 'resign', extraLogs);
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
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作其他员工的数据' });
      }
    } else if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权操作其他员工的数据' });
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

  // 批量状态更新（对齐老项目「一键在职/离休」）：仅处理数据范围内的员工，越权自动跳过
  async batchUpdateStatus(
    userId: number,
    input: { ids: number[]; status: 'active' | 'resigned' },
  ): Promise<{ success: number; skipped: number }> {
    const { ids, status } = input;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '请选择要操作的员工' });
    }
    if (status !== EmployeeStatus.active && status !== EmployeeStatus.resigned) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '不支持的批量状态' });
    }
    const scope = await this.visibleScope(userId);
    const employees = await this.prisma.employee.findMany({ where: { id: { in: ids } } });
    // 数据范围过滤：仅操作可见部门（或本人）内的员工
    const scoped = employees.filter(
      (emp) => scope.all || scope.selfEmployeeId === emp.id || scope.ids.includes(emp.departmentId),
    );
    const changeType = status === EmployeeStatus.resigned ? 'resign' : 'restore';
    await this.prisma.$transaction(async (tx) => {
      for (const emp of scoped) {
        const updateData: any = { status };
        if (status === EmployeeStatus.resigned) {
          updateData.resignDate = new Date();
        } else {
          updateData.resignDate = null;
        }
        const updated = await tx.employee.update({ where: { id: emp.id }, data: updateData });
        await this.recordChangeLogsWithTx(tx, emp.id, emp, updateData, userId, changeType);
        void updated;
      }
    });
    return { success: scoped.length, skipped: ids.length - scoped.length };
  }

  // 批量调整部门/岗位/职级（仅接受明确允许的字段），逐人校验数据范围并记录变更流水
  async batchUpdate(
    userId: number,
    input: { ids: number[]; data: { departmentId?: number; positionId?: number | null; rating?: number } },
  ): Promise<{ success: number; skipped: number }> {
    const { ids, data } = input;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '请选择要操作的员工' });
    }
    const ALLOWED = ['departmentId', 'positionId', 'rating'] as const;
    const updateData: any = {};
    for (const key of ALLOWED) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '请选择要调整的字段' });
    }

    const scope = await this.visibleScope(userId);
    const employees = await this.prisma.employee.findMany({ where: { id: { in: ids } } });
    const scoped = employees.filter(
      (emp) => scope.all || scope.selfEmployeeId === emp.id || scope.ids.includes(emp.departmentId),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const emp of scoped) {
        const updated = await tx.employee.update({ where: { id: emp.id }, data: updateData });
        await this.recordChangeLogsWithTx(tx, emp.id, emp, updateData, userId, 'batch_update');
        void updated;
      }
    });
    return { success: scoped.length, skipped: ids.length - scoped.length };
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

  // 批量变动记录流水（对齐 EmployeeChanges）：全员工分页展示，按 changeType/关键字过滤，经数据范围隔离
  async listChangeLogs(userId: number, query: {
    page: number;
    pageSize: number;
    changeType?: string;
    keyword?: string;
    departmentId?: number | string;
  }) {
    const scope = await this.visibleScope(userId);
    const where: Prisma.EmployeeChangeLogWhereInput = {};
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    // 部门过滤与数据范围叠加（AND）；越出可视范围时置空结果，杜绝越权
    if (query.departmentId !== undefined && query.departmentId !== null && query.departmentId !== '') {
      const fid = Number(query.departmentId);
      if (scope.all || scope.ids.includes(fid)) {
        where.employee = { ...(where.employee as object), departmentId: { in: [fid] } };
      } else if (!scope.all) {
        where.employee = { ...(where.employee as object), departmentId: { in: [-1] } };
      }
    }
    if (query.changeType) {
      where.changeType = query.changeType;
    }
    if (query.keyword) {
      where.employee = {
        ...(where.employee as object),
        OR: [
          { name: { contains: query.keyword } },
          { employeeNo: { contains: query.keyword } },
        ],
      };
    }
    const [list, total] = await Promise.all([
      this.prisma.employeeChangeLog.findMany({
        where,
        include: {
          employee: {
            select: {
              employeeNo: true,
              name: true,
              hireDate: true,
              department: { select: { id: true, name: true } },
              position: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeChangeLog.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
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
    extraLogs?: Array<{
      employeeId: number;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: number;
      changeType: string;
    }>,
  ) {
    const changeLogs = this.buildChangeLogs(employeeId, oldEmployee, updateData, changedBy, changeType);
    if (extraLogs && extraLogs.length > 0) {
      changeLogs.push(...extraLogs);
    }
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
