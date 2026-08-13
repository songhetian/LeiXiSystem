import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Employee } from '@prisma/client';

// 员工聚合根服务（S03）：CRUD + 离职状态机 + 部门数据隔离（ADR-0010，经 DataScopeService 统一注入）
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async create(dto: any) {
    const exists = await this.prisma.employee.findUnique({ where: { employeeNo: dto.employeeNo } });
    if (exists) throw new ConflictException({ code: 1001, message: '工号已存在' });
    return this.prisma.employee.create({
      data: { ...dto, hireDate: new Date(dto.hireDate) },
    });
  }

  async list(userId: number, query: { page: number; pageSize: number; keyword?: string }) {
    const scope = await this.visibleScope(userId);
    const where: any = {};
    if (!scope.all) where.departmentId = { in: scope.ids };
    if (query.keyword) {
      where.OR = [
        { employeeNo: { contains: query.keyword } },
        { name: { contains: query.keyword } },
      ];
    }
    const [list, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: { department: true, position: true },
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
    if (!scope.all && !scope.ids.includes(employee.departmentId)) {
      throw new NotFoundException({ code: 1002, message: '员工不存在' });
    }
    return employee;
  }

  async update(id: number, dto: any) {
    const employee = await this.getActive(id);
    return this.prisma.employee.update({ where: { id: employee.id }, data: dto });
  }

  async resign(id: number) {
    const employee = await this.getActive(id);
    return this.prisma.employee.update({
      where: { id: employee.id },
      data: { status: 'resigned', resignDate: new Date() },
    });
  }

  // 离职状态机：仅 active 可修改/离职
  private async getActive(id: number): Promise<Employee> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException({ code: 1002, message: '员工不存在' });
    if (employee.status === 'resigned') {
      throw new ConflictException({ code: 1004, message: '员工已离职，不可操作' });
    }
    return employee;
  }

  // ADR-0010：可见部门范围（统一经 DataScopeService）
  private async visibleScope(userId: number) {
    return this.dataScope.visibleScope(userId);
  }
}
