import { Injectable, ConflictException, UnprocessableEntityException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';

// 排班聚合（S04）：员工×日期×班次，uk(employee, workDate)；重复 → 2002（含批量原子性）
@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async create(dto: { employeeId: number; shiftId: number; workDate: string }, userId: number) {
    // 数据隔离：经理只能给本部门员工排班（ADR-0010）
    await this.assertInScope(dto.employeeId, userId);
    try {
      return await this.prisma.schedule.create({
        data: { ...dto, workDate: new Date(dto.workDate) },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2002, message: '该员工当日已排班' });
      }
      if (e.code === 'P2003') {
        throw new UnprocessableEntityException({ code: 1002, message: '员工或班次不存在' });
      }
      throw e;
    }
  }

  // 批量排班：事务内逐条插入，冲突整体回滚（原子性）
  async batch(items: { employeeId: number; shiftId: number; workDate: string }[], userId: number) {
    for (const item of items) {
      await this.assertInScope(item.employeeId, userId);
    }
    try {
      const count = await this.prisma.$transaction(async (tx) => {
        let n = 0;
        for (const item of items) {
          await tx.schedule.create({ data: { ...item, workDate: new Date(item.workDate) } });
          n++;
        }
        return n;
      });
      return { count };
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2002, message: '批量排班存在重复（已全部回滚）' });
      }
      if (e.code === 'P2003') {
        throw new UnprocessableEntityException({ code: 1002, message: '员工或班次不存在' });
      }
      throw e;
    }
  }

  async list(
    userId: number,
    query: { employeeId?: number; startDate?: string; endDate?: string; page: number; pageSize: number },
  ) {
    const scope = await this.dataScope.visibleScope(userId);
    const where: any = {};
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (query.employeeId) where.employeeId = Number(query.employeeId);
    if (query.startDate || query.endDate) {
      where.workDate = {};
      if (query.startDate) where.workDate.gte = new Date(query.startDate);
      if (query.endDate) where.workDate.lte = new Date(query.endDate);
    }
    const [list, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: { employee: { select: { id: true, employeeNo: true, name: true } }, shift: true },
        orderBy: { workDate: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.schedule.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  async update(id: number, dto: { employeeId?: number; shiftId?: number; workDate?: string }, userId: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException({ code: 2002, message: '排班不存在' });
    }

    const targetEmployeeId = dto.employeeId ?? schedule.employeeId;
    await this.assertInScope(targetEmployeeId, userId);

    const data: any = {};
    if (dto.employeeId !== undefined) data.employeeId = dto.employeeId;
    if (dto.shiftId !== undefined) data.shiftId = dto.shiftId;
    if (dto.workDate !== undefined) data.workDate = new Date(dto.workDate);

    try {
      return await this.prisma.schedule.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2002, message: '该员工当日已排班' });
      }
      if (e.code === 'P2003') {
        throw new UnprocessableEntityException({ code: 1002, message: '员工或班次不存在' });
      }
      throw e;
    }
  }

  async remove(id: number, userId: number) {
    const schedule = await this.prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      throw new NotFoundException({ code: 2002, message: '排班不存在' });
    }
    await this.assertInScope(schedule.employeeId, userId);

    await this.prisma.schedule.delete({ where: { id } });
    return { success: true };
  }

  private async assertInScope(employeeId: number, userId: number) {
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.all) return;
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !scope.ids.includes(employee.departmentId)) {
      throw new ForbiddenException({ code: 5003, message: '无权限为该员工排班' });
    }
  }
}
