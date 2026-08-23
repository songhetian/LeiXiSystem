import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeStatus } from '@prisma/client';
import { buildTimeline } from './timeline-builder';
import { ApprovalService } from '../approval/approval.service';
import { DataScopeService } from '../common/data-scope.service';
import { withEventRetry } from '../common/event-retry.util';
import { ERROR_CODES } from '../common/error-codes';
import {
  isValidDate,
  isDateNotTooFarFuture,
  isDateNotBeforeHireDate,
} from '../common/date.util';
import * as ExcelJS from 'exceljs';
import {
  validateOrThrow,
  createOnboardingSchema,
  updateOnboardingSchema,
  createResignationSchema,
  updateResignationSchema,
  createProbationSchema,
  updateProbationSchema,
  createContractSchema,
  updateContractSchema,
  createAppealSchema,
  updateAppealSchema,
  createCertificateSchema,
  updateCertificateSchema,
  createRewardSchema,
  updateRewardSchema,
  createTrainingSchema,
  updateTrainingSchema,
  createTransferSchema,
  updateTransferSchema,
  createCertRequestSchema,
  updateCertRequestSchema,
} from './dto/employee-tx.schemas';

@Injectable()
export class EmployeeTxService {
  private readonly logger = new Logger(EmployeeTxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
    private readonly dataScope: DataScopeService,
  ) {}

  async getEmployeeByUserId(userId: number) {
    return this.prisma.employee.findUnique({
      where: { userId },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    });
  }

  async updateMyProfile(userId: number, data: { phone?: string; emergencyContact?: string; emergencyPhone?: string }) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) throw new NotFoundException({ code: 9701, message: '员工档案不存在' });
    const updateData: any = {};
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact;
    if (data.emergencyPhone !== undefined) updateData.emergencyPhone = data.emergencyPhone;
    if (Object.keys(updateData).length === 0) return emp;
    return this.prisma.employee.update({ where: { id: emp.id }, data: updateData });
  }

  // ===== 入职登记 =====
  async listOnboarding(params: { page?: number; pageSize?: number; status?: string; keyword?: string; userId: number }) {
    const { page = 1, pageSize = 20, status, keyword, userId } = params;
    const where: any = {};
    if (status) where.status = status;
    if (keyword) where.OR = [{ name: { contains: keyword } }, { phone: { contains: keyword } }];
    await this.applyDepartmentScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.onboarding.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' } }),
      this.prisma.onboarding.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createOnboarding(dto: any, userId: number) {
    const valid = validateOrThrow(createOnboardingSchema, dto);
    return this.prisma.onboarding.create({ data: { ...valid, createdBy: userId } });
  }

  async updateOnboarding(id: number, dto: any) {
    const record = await this.prisma.onboarding.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9001, message: '入职登记不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9002, message: '只有草稿状态可编辑' });
    const valid = validateOrThrow(updateOnboardingSchema, dto);
    return this.prisma.onboarding.update({ where: { id }, data: valid });
  }

  async deleteOnboarding(id: number) {
    const record = await this.prisma.onboarding.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9001, message: '入职登记不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9002, message: '只有草稿状态可删除' });
    await this.prisma.onboarding.delete({ where: { id } });
    return { success: true };
  }

  async submitOnboarding(id: number, userId: number, workflowCode: string) {
    const record = await this.prisma.onboarding.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9001, message: '入职登记不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9002, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9003, message: '已提交审批' });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `入职登记 - ${record.name}`,
      formData: { onboardingId: record.id, name: record.name },
      userId,
      userName: user!.realName,
    });

    return this.prisma.onboarding.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  // ===== 离职申请 =====
  async listResignations(params: { page?: number; pageSize?: number; status?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, status, employeeId, userId } = params;
    const where: any = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.resignation.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true, departmentId: true } } },
      }),
      this.prisma.resignation.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createResignation(dto: any, userId: number) {
    const valid = validateOrThrow(createResignationSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9101, message: '员工不存在' });
    if (emp.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    return this.prisma.resignation.create({ data: { ...valid, resignDate: new Date(valid.resignDate) } });
  }

  async updateResignation(id: number, dto: any, userId: number) {
    const record = await this.prisma.resignation.findUnique({ where: { id }, include: { employee: true } });
    if (!record) throw new NotFoundException({ code: 9101, message: '离职申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9102, message: '只有草稿状态可编辑' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    const valid = validateOrThrow(updateResignationSchema, dto);
    return this.prisma.resignation.update({ where: { id }, data: valid });
  }

  async deleteResignation(id: number, userId: number) {
    const record = await this.prisma.resignation.findUnique({ where: { id }, include: { employee: true } });
    if (!record) throw new NotFoundException({ code: 9101, message: '离职申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9102, message: '只有草稿状态可删除' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    await this.prisma.resignation.delete({ where: { id } });
    return { success: true };
  }

  async submitResignation(id: number, userId: number, workflowCode: string) {
    const record = await this.prisma.resignation.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9101, message: '离职申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9102, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9103, message: '已提交审批' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `离职申请 - ${record.employee.name}`,
      formData: { resignationId: record.id, reason: record.reason },
      userId,
      userName: user!.realName,
      departmentId: record.employee.departmentId ?? undefined,
    });

    return this.prisma.resignation.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  // ===== 转正申请 =====
  async listProbations(params: { page?: number; pageSize?: number; status?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, status, employeeId, userId } = params;
    const where: any = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.probation.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true, departmentId: true } } },
      }),
      this.prisma.probation.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createProbation(dto: any) {
    const valid = validateOrThrow(createProbationSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9201, message: '员工不存在' });
    return this.prisma.probation.create({
      data: {
        ...valid,
        probationStartDate: new Date(valid.probationStartDate),
        probationEndDate: new Date(valid.probationEndDate),
      },
    });
  }

  async updateProbation(id: number, dto: any) {
    const record = await this.prisma.probation.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9201, message: '转正申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9202, message: '只有草稿状态可编辑' });
    const valid = validateOrThrow(updateProbationSchema, dto);
    return this.prisma.probation.update({ where: { id }, data: valid });
  }

  async deleteProbation(id: number) {
    const record = await this.prisma.probation.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9201, message: '转正申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9202, message: '只有草稿状态可删除' });
    await this.prisma.probation.delete({ where: { id } });
    return { success: true };
  }

  async submitProbation(id: number, userId: number, workflowCode: string) {
    const record = await this.prisma.probation.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9201, message: '转正申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9202, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9203, message: '已提交审批' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `转正申请 - ${record.employee.name}`,
      formData: { probationId: record.id },
      userId,
      userName: user!.realName,
      departmentId: record.employee.departmentId ?? undefined,
    });

    return this.prisma.probation.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  // ===== 合同管理 =====
  async listContracts(params: { page?: number; pageSize?: number; status?: string; employeeId?: number; keyword?: string; userId: number }) {
    const { page = 1, pageSize = 20, status, employeeId, keyword, userId } = params;
    const where: any = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (keyword) where.employee = { name: { contains: keyword } };
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.contract.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true } } },
      }),
      this.prisma.contract.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createContract(dto: any) {
    const valid = validateOrThrow(createContractSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9301, message: '员工不存在' });
    return this.prisma.contract.create({
      data: { ...valid, startDate: new Date(valid.startDate), endDate: valid.endDate ? new Date(valid.endDate) : null },
    });
  }

  async updateContract(id: number, dto: any) {
    const record = await this.prisma.contract.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9301, message: '合同不存在' });
    const valid = validateOrThrow(updateContractSchema, dto);
    return this.prisma.contract.update({ where: { id }, data: valid });
  }

  async deleteContract(id: number) {
    const record = await this.prisma.contract.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9301, message: '合同不存在' });
    await this.prisma.contract.delete({ where: { id } });
    return { success: true };
  }

  // ===== 考勤申诉 =====
  async listAppeals(params: { page?: number; pageSize?: number; status?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, status, employeeId, userId } = params;
    const where: any = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.attendanceAppeal.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true, departmentId: true } } },
      }),
      this.prisma.attendanceAppeal.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createAppeal(dto: any, userId: number) {
    const valid = validateOrThrow(createAppealSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9401, message: '员工不存在' });
    if (emp.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });

    if (!isValidDate(valid.appealDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '申诉日期格式无效' });
    }
    if (!isDateNotTooFarFuture(valid.appealDate, 1)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '申诉日期不能超过当前日期1年以上' });
    }
    if (emp.hireDate && !isDateNotBeforeHireDate(valid.appealDate, emp.hireDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '申诉日期不能早于入职日期' });
    }

    return this.prisma.attendanceAppeal.create({
      data: { ...valid, appealDate: new Date(valid.appealDate) },
    });
  }

  async updateAppeal(id: number, dto: any, userId: number) {
    const record = await this.prisma.attendanceAppeal.findUnique({ where: { id }, include: { employee: true } });
    if (!record) throw new NotFoundException({ code: 9401, message: '申诉不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9402, message: '只有草稿状态可编辑' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    const valid = validateOrThrow(updateAppealSchema, dto);

    if (valid.appealDate !== undefined) {
      if (!isValidDate(valid.appealDate)) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '申诉日期格式无效' });
      }
      if (!isDateNotTooFarFuture(valid.appealDate, 1)) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '申诉日期不能超过当前日期1年以上' });
      }
      if (record.employee.hireDate && !isDateNotBeforeHireDate(valid.appealDate, record.employee.hireDate)) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '申诉日期不能早于入职日期' });
      }
    }

    return this.prisma.attendanceAppeal.update({ where: { id }, data: valid });
  }

  async deleteAppeal(id: number, userId: number) {
    const record = await this.prisma.attendanceAppeal.findUnique({ where: { id }, include: { employee: true } });
    if (!record) throw new NotFoundException({ code: 9401, message: '申诉不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9402, message: '只有草稿状态可删除' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    await this.prisma.attendanceAppeal.delete({ where: { id } });
    return { success: true };
  }

  async submitAppeal(id: number, userId: number, workflowCode: string) {
    const record = await this.prisma.attendanceAppeal.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9401, message: '申诉不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9402, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9403, message: '已提交审批' });
    if (record.employee.userId !== userId) throw new ForbiddenException({ code: 5003, message: '无权限操作' });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `考勤申诉 - ${record.employee.name}`,
      formData: { appealId: record.id, appealType: record.appealType },
      userId,
      userName: user!.realName,
      departmentId: record.employee.departmentId ?? undefined,
    });

    return this.prisma.attendanceAppeal.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  // ===== 证书管理 =====
  async listCertificates(params: { page?: number; pageSize?: number; employeeId?: number; keyword?: string; userId: number }) {
    const { page = 1, pageSize = 20, employeeId, keyword, userId } = params;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (keyword) where.OR = [{ name: { contains: keyword } }, { certNo: { contains: keyword } }];
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.employeeCertificate.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true } } },
      }),
      this.prisma.employeeCertificate.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createCertificate(dto: any) {
    const valid = validateOrThrow(createCertificateSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9501, message: '员工不存在' });
    const data: any = { ...valid };
    if (valid.issueDate) data.issueDate = new Date(valid.issueDate);
    if (valid.expireDate) data.expireDate = new Date(valid.expireDate);
    return this.prisma.employeeCertificate.create({ data });
  }

  async updateCertificate(id: number, dto: any) {
    const record = await this.prisma.employeeCertificate.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9501, message: '证书不存在' });
    const valid = validateOrThrow(updateCertificateSchema, dto);
    return this.prisma.employeeCertificate.update({ where: { id }, data: valid });
  }

  async deleteCertificate(id: number) {
    const record = await this.prisma.employeeCertificate.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9501, message: '证书不存在' });
    await this.prisma.employeeCertificate.delete({ where: { id } });
    return { success: true };
  }

  // ===== 奖惩记录 =====
  async listRewards(params: { page?: number; pageSize?: number; type?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, type, employeeId, userId } = params;
    const where: any = {};
    if (type) where.type = type;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.employeeReward.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true } } },
      }),
      this.prisma.employeeReward.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async exportRewards(userId: number, params: {
    type?: string;
    startDate?: string;
    endDate?: string;
    departmentId?: number;
  }): Promise<Buffer> {
    const where: any = {};
    if (params.type) where.type = params.type;
    if (params.startDate || params.endDate) {
      where.rewardDate = {};
      if (params.startDate) where.rewardDate.gte = new Date(params.startDate);
      if (params.endDate) where.rewardDate.lte = new Date(params.endDate);
    }
    await this.applyEmployeeScope(where, userId);
    if (params.departmentId) {
      const employees = await this.prisma.employee.findMany({
        where: { departmentId: params.departmentId },
        select: { id: true },
      });
      const deptEmployeeIds = employees.map((e) => e.id);
      if (where.employeeId && typeof where.employeeId === 'object' && 'in' in where.employeeId) {
        where.employeeId.in = where.employeeId.in.filter((id: number) => deptEmployeeIds.includes(id));
      } else if (typeof where.employeeId === 'number') {
        if (!deptEmployeeIds.includes(where.employeeId)) {
          where.employeeId = { in: [] };
        }
      } else {
        where.employeeId = { in: deptEmployeeIds };
      }
    }

    const rewards = await this.prisma.employeeReward.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        employee: { include: { department: { select: { id: true, name: true } } } },
      },
    });

    const handlerIds = [...new Set(rewards.map((r) => r.handledBy).filter((id): id is number => id !== null))];
    const handlers = await this.prisma.employee.findMany({
      where: { userId: { in: handlerIds } },
      select: { userId: true, name: true },
    });
    const handlerMap = new Map(handlers.map((h) => [h.userId, h.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('奖惩记录');
    sheet.columns = [
      { header: '员工', key: 'employeeName', width: 12 },
      { header: '部门', key: 'department', width: 20 },
      { header: '类型', key: 'type', width: 10 },
      { header: '原因', key: 'reason', width: 30 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '日期', key: 'rewardDate', width: 15 },
      { header: '创建人', key: 'handledBy', width: 12 },
    ];

    const typeMap: Record<string, string> = {
      reward: '奖励',
      punishment: '惩罚',
    };

    rewards.forEach((r) => {
      sheet.addRow({
        employeeName: r.employee?.name || '',
        department: r.employee?.department?.name || '',
        type: typeMap[r.type] || r.type,
        reason: r.reason || '',
        amount: r.amount ? r.amount.toString() : '',
        rewardDate: r.rewardDate ? r.rewardDate.toISOString().split('T')[0] : '',
        handledBy: r.handledBy ? handlerMap.get(r.handledBy) || '' : '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }

  async createReward(dto: any) {
    const valid = validateOrThrow(createRewardSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9601, message: '员工不存在' });
    return this.prisma.employeeReward.create({
      data: { ...valid, rewardDate: new Date(valid.rewardDate), type: valid.type as any },
    });
  }

  async updateReward(id: number, dto: any) {
    const record = await this.prisma.employeeReward.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9601, message: '奖惩记录不存在' });
    const valid = validateOrThrow(updateRewardSchema, dto);
    return this.prisma.employeeReward.update({ where: { id }, data: valid });
  }

  async deleteReward(id: number) {
    const record = await this.prisma.employeeReward.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9601, message: '奖惩记录不存在' });
    await this.prisma.employeeReward.delete({ where: { id } });
    return { success: true };
  }

  async submitReward(id: number, userId: number, workflowCode: string, options?: { checkOwnership?: boolean }) {
    const record = await this.prisma.employeeReward.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9601, message: '奖惩记录不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9602, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9603, message: '已提交审批' });
    if (options?.checkOwnership !== false && record.employee.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `${record.type === 'reward' ? '奖励' : '惩罚'}申请 - ${record.employee.name}`,
      formData: { rewardId: record.id, type: record.type },
      userId,
      userName: user!.realName,
      departmentId: record.employee.departmentId ?? undefined,
    });

    return this.prisma.employeeReward.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  // ===== 证明申请 =====
  async listCertRequests(params: { page?: number; pageSize?: number; type?: string; status?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, type, status, employeeId, userId } = params;
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.certificateRequest.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true } } },
      }),
      this.prisma.certificateRequest.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async getCertRequest(id: number, userId?: number, options?: { checkOwnership?: boolean }) {
    const record = await this.prisma.certificateRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9801, message: '证明申请不存在' });
    if (options?.checkOwnership !== false && userId !== undefined && record.employee.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    return record;
  }

  async createCertRequest(dto: any, userId?: number, options?: { checkOwnership?: boolean }) {
    const valid = validateOrThrow(createCertRequestSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9701, message: '员工不存在' });
    if (options?.checkOwnership !== false && userId !== undefined && emp.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    return this.prisma.certificateRequest.create({ data: valid });
  }

  async updateCertRequest(id: number, dto: any, userId?: number, options?: { checkOwnership?: boolean }) {
    const record = await this.prisma.certificateRequest.findUnique({ where: { id }, include: { employee: true } });
    if (!record) throw new NotFoundException({ code: 9801, message: '证明申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9802, message: '只有草稿状态可修改' });
    if (options?.checkOwnership !== false && userId !== undefined && record.employee.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    const valid = validateOrThrow(updateCertRequestSchema, dto);
    return this.prisma.certificateRequest.update({ where: { id }, data: valid });
  }

  async deleteCertRequest(id: number, userId?: number, options?: { checkOwnership?: boolean }) {
    const record = await this.prisma.certificateRequest.findUnique({ where: { id }, include: { employee: true } });
    if (!record) throw new NotFoundException({ code: 9801, message: '证明申请不存在' });
    if (options?.checkOwnership !== false && userId !== undefined && record.employee.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    await this.prisma.certificateRequest.delete({ where: { id } });
    return { success: true };
  }

  async submitCertRequest(id: number, userId: number, workflowCode: string, options?: { checkOwnership?: boolean }) {
    const record = await this.prisma.certificateRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9801, message: '证明申请不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9802, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9803, message: '已提交审批' });
    if (options?.checkOwnership !== false && record.employee.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const typeName: Record<string, string> = {
      employment: '在职证明', income: '收入证明', resignation: '离职证明', other: '证明申请',
    };
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `${typeName[record.type] || '证明申请'} - ${record.employee.name}`,
      formData: { requestId: record.id, type: record.type },
      userId,
      userName: user!.realName,
      departmentId: record.employee.departmentId ?? undefined,
    });

    return this.prisma.certificateRequest.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  async markCertRequestCompleted(id: number, userId: number) {
    const record = await this.prisma.certificateRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9801, message: '证明申请不存在' });
    if (record.status !== 'approved') {
      throw new BadRequestException({ code: 9804, message: '只有审批通过的证明申请可标记为已完成' });
    }
    return this.prisma.certificateRequest.update({
      where: { id },
      data: { status: 'completed', handledBy: userId, deliveredAt: new Date() },
    });
  }

  async cancelCertRequest(id: number, userId: number, options?: { checkOwnership?: boolean }) {
    const record = await this.prisma.certificateRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9801, message: '证明申请不存在' });
    if (record.status !== 'draft' && record.status !== 'pending') {
      throw new BadRequestException({ code: 9805, message: '只有草稿或待审批状态可取消' });
    }
    if (options?.checkOwnership !== false && record.employee.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    return this.prisma.certificateRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  // ===== 培训记录 =====
  async listTrainings(params: { page?: number; pageSize?: number; category?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, category, employeeId, userId } = params;
    const where: any = {};
    if (category) where.category = category;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.trainingRecord.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true } } },
      }),
      this.prisma.trainingRecord.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createTraining(dto: any) {
    const valid = validateOrThrow(createTrainingSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9701, message: '员工不存在' });
    const data: any = { ...valid };
    if (valid.startDate) data.startDate = new Date(valid.startDate);
    if (valid.endDate) data.endDate = new Date(valid.endDate);
    return this.prisma.trainingRecord.create({ data });
  }

  async updateTraining(id: number, dto: any) {
    const record = await this.prisma.trainingRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9701, message: '培训记录不存在' });
    const valid = validateOrThrow(updateTrainingSchema, dto);
    return this.prisma.trainingRecord.update({ where: { id }, data: valid });
  }

  async deleteTraining(id: number) {
    const record = await this.prisma.trainingRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9701, message: '培训记录不存在' });
    await this.prisma.trainingRecord.delete({ where: { id } });
    return { success: true };
  }

  // ===== 调岗调薪 =====
  async listTransfers(params: { page?: number; pageSize?: number; type?: string; status?: string; employeeId?: number; userId: number }) {
    const { page = 1, pageSize = 20, type, status, employeeId, userId } = params;
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    await this.applyEmployeeScope(where, userId);
    const [list, total] = await Promise.all([
      this.prisma.employeeTransfer.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: 'desc' },
        include: { employee: { select: { id: true, name: true, employeeNo: true, departmentId: true } } },
      }),
      this.prisma.employeeTransfer.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createTransfer(dto: any) {
    const valid = validateOrThrow(createTransferSchema, dto);
    const emp = await this.prisma.employee.findUnique({ where: { id: valid.employeeId } });
    if (!emp) throw new NotFoundException({ code: 9801, message: '员工不存在' });
    return this.prisma.employeeTransfer.create({
      data: { ...valid, effectiveDate: new Date(valid.effectiveDate), type: valid.type as any },
    });
  }

  async updateTransfer(id: number, dto: any) {
    const record = await this.prisma.employeeTransfer.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9801, message: '调岗调薪记录不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9802, message: '只有草稿状态可编辑' });
    const valid = validateOrThrow(updateTransferSchema, dto);
    return this.prisma.employeeTransfer.update({ where: { id }, data: valid });
  }

  async deleteTransfer(id: number) {
    const record = await this.prisma.employeeTransfer.findUnique({ where: { id } });
    if (!record) throw new NotFoundException({ code: 9801, message: '调岗调薪记录不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9802, message: '只有草稿状态可删除' });
    await this.prisma.employeeTransfer.delete({ where: { id } });
    return { success: true };
  }

  async submitTransfer(id: number, userId: number, workflowCode: string) {
    const record = await this.prisma.employeeTransfer.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException({ code: 9801, message: '调岗调薪记录不存在' });
    if (record.status !== 'draft') throw new BadRequestException({ code: 9802, message: '只有草稿状态可提交' });
    if (record.approvalInstanceId) throw new BadRequestException({ code: 9803, message: '已提交审批' });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const instance = await this.approvalService.startInstance({
      workflowCode,
      title: `调动申请 - ${record.employee.name}`,
      formData: { transferId: record.id },
      userId,
      userName: user!.realName,
      departmentId: record.employee.departmentId ?? undefined,
    });

    return this.prisma.employeeTransfer.update({
      where: { id },
      data: { status: 'pending', approvalInstanceId: instance.id },
    });
  }

  // ===== 审批事件监听 =====
  @OnEvent('approval.approved')
  async handleApprovalApproved(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'resignation') {
          await this.handleResignationApproved(instanceId);
        } else if (workflowCode === 'onboarding') {
          await this.handleOnboardingApproved(instanceId);
        } else if (workflowCode === 'probation') {
          await this.handleProbationApproved(instanceId);
        } else if (workflowCode === 'transfer') {
          await this.handleTransferApproved(instanceId);
        } else if (workflowCode === 'attendance_appeal') {
          await this.handleAppealApproved(instanceId);
        } else if (workflowCode === 'reward_punishment') {
          await this.handleRewardApproved(instanceId);
        } else if (workflowCode === 'cert_request') {
          await this.handleCertRequestApproved(instanceId);
        }
      },
      `approval.approved (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'resignation') {
          await this.handleResignationRejected(instanceId);
        } else if (workflowCode === 'onboarding') {
          await this.handleOnboardingRejected(instanceId);
        } else if (workflowCode === 'probation') {
          await this.handleProbationRejected(instanceId);
        } else if (workflowCode === 'transfer') {
          await this.handleTransferRejected(instanceId);
        } else if (workflowCode === 'attendance_appeal') {
          await this.handleAppealRejected(instanceId);
        } else if (workflowCode === 'reward_punishment') {
          await this.handleRewardRejected(instanceId);
        } else if (workflowCode === 'cert_request') {
          await this.handleCertRequestRejected(instanceId);
        }
      },
      `approval.rejected (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.withdrawn')
  async handleApprovalWithdrawn(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'onboarding') {
          await this.handleOnboardingWithdrawn(instanceId);
        } else if (workflowCode === 'probation') {
          await this.handleProbationWithdrawn(instanceId);
        } else if (workflowCode === 'resignation') {
          await this.handleResignationWithdrawn(instanceId);
        } else if (workflowCode === 'transfer') {
          await this.handleTransferWithdrawn(instanceId);
        } else if (workflowCode === 'reward_punishment') {
          await this.handleRewardWithdrawn(instanceId);
        } else {
          await this.handleGenericWithdrawn(instanceId, workflowCode);
        }
      },
      `approval.withdrawn (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  private async handleGenericWithdrawn(instanceId: number, workflowCode: string) {
    const modelMap: Record<string, string> = {
      attendance_appeal: 'attendanceAppeal',
      cert_request: 'certificateRequest',
    };
    const model = modelMap[workflowCode];
    if (!model) return;

    const record = await (this.prisma as any)[model].findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status !== 'pending' && record.status !== 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await (tx as any)[model].update({
        where: { id: record.id },
        data: { status: 'draft', approvalInstanceId: null },
      });
    });

    this.logger.log(`${workflowCode} 审批撤回: id=${record.id}, instanceId=${instanceId}`);
  }

  private async handleOnboardingWithdrawn(instanceId: number) {
    const onboarding = await this.prisma.onboarding.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!onboarding) return;
    if (onboarding.status !== 'pending' && onboarding.status !== 'approved') return;

    const isApproved = onboarding.status === 'approved';

    await this.prisma.$transaction(async (tx) => {
      await tx.onboarding.update({
        where: { id: onboarding.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (isApproved) {
        const employee = await tx.employee.findFirst({
          where: {
            phone: onboarding.phone,
            name: onboarding.name,
          },
        });
        if (employee) {
          await tx.employee.delete({
            where: { id: employee.id },
          });
          this.logger.log(`入职审批撤回，已删除员工记录: employeeId=${employee.id}`);
        }
      }
    });

    this.logger.log(`onboarding 审批撤回: id=${onboarding.id}, instanceId=${instanceId}`);
  }

  private async handleProbationWithdrawn(instanceId: number) {
    const probation = await this.prisma.probation.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!probation) return;
    if (probation.status !== 'pending' && probation.status !== 'approved') return;

    const isApproved = probation.status === 'approved';

    await this.prisma.$transaction(async (tx) => {
      await tx.probation.update({
        where: { id: probation.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (isApproved) {
        await tx.employee.update({
          where: { id: probation.employeeId },
          data: { status: EmployeeStatus.probation },
        });
        this.logger.log(`转正审批撤回，员工状态恢复为 probation: employeeId=${probation.employeeId}`);
      }
    });

    this.logger.log(`probation 审批撤回: id=${probation.id}, instanceId=${instanceId}`);
  }

  private async handleResignationWithdrawn(instanceId: number) {
    const resignation = await this.prisma.resignation.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!resignation) return;
    if (resignation.status !== 'pending' && resignation.status !== 'approved') return;

    const isApproved = resignation.status === 'approved';

    await this.prisma.$transaction(async (tx) => {
      await tx.resignation.update({
        where: { id: resignation.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (isApproved) {
        await tx.employee.update({
          where: { id: resignation.employeeId },
          data: { status: EmployeeStatus.active, resignDate: null },
        });
        this.logger.log(`离职审批撤回，员工状态恢复为 active: employeeId=${resignation.employeeId}`);
      }
    });

    this.logger.log(`resignation 审批撤回: id=${resignation.id}, instanceId=${instanceId}`);
  }

  private async handleTransferWithdrawn(instanceId: number) {
    const transfer = await this.prisma.employeeTransfer.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!transfer) return;
    if (transfer.status !== 'pending' && transfer.status !== 'approved') return;

    const isApproved = transfer.status === 'approved';

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeTransfer.update({
        where: { id: transfer.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (isApproved) {
        const updateData: any = {};
        if (transfer.fromDepartmentId !== undefined && transfer.fromDepartmentId !== null) {
          updateData.departmentId = transfer.fromDepartmentId;
        }
        if (transfer.fromPositionId !== undefined && transfer.fromPositionId !== null) {
          updateData.positionId = transfer.fromPositionId;
        }
        if (transfer.fromSalary !== undefined && transfer.fromSalary !== null) {
          updateData.salary = transfer.fromSalary;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.employee.update({
            where: { id: transfer.employeeId },
            data: updateData,
          });
          this.logger.log(`调岗审批撤回，员工信息已恢复: employeeId=${transfer.employeeId}`);
        }

        if (transfer.toSalary && transfer.fromSalary && transfer.effectiveDate) {
          const effectiveMonth = transfer.effectiveDate.toISOString().slice(0, 7);
          const run = await tx.payrollRun.findUnique({ where: { month: effectiveMonth } });
          if (run) {
            await tx.payrollAdjustment.deleteMany({
              where: {
                runId: run.id,
                employeeId: transfer.employeeId,
                itemCode: { in: ['salary_increase', 'salary_decrease'] },
              },
            });
            this.logger.log(`调岗审批撤回，已删除薪资调整记录: employeeId=${transfer.employeeId}`);
          }
        }
      }
    });

    this.logger.log(`transfer 审批撤回: id=${transfer.id}, instanceId=${instanceId}`);
  }

  private async handleRewardWithdrawn(instanceId: number) {
    const reward = await this.prisma.employeeReward.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!reward) return;
    if (reward.status !== 'pending' && reward.status !== 'approved') return;

    const isApproved = reward.status === 'approved';

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeReward.update({
        where: { id: reward.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (isApproved && reward.amount) {
        const month = reward.rewardDate.toISOString().slice(0, 7);
        const run = await tx.payrollRun.findUnique({ where: { month } });
        if (run) {
          const itemCode = reward.type === 'reward' ? 'bonus' : 'fine';
          await tx.payrollAdjustment.deleteMany({
            where: {
              runId: run.id,
              employeeId: reward.employeeId,
              itemCode,
            },
          });
          this.logger.log(`奖惩审批撤回，已删除薪资调整记录: rewardId=${reward.id}`);
        }
      }
    });

    this.logger.log(`reward_punishment 审批撤回: id=${reward.id}, instanceId=${instanceId}`);
  }

  @OnEvent('approval.resubmitted')
  async handleApprovalResubmitted(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        const modelMap: Record<string, string> = {
          resignation: 'resignation',
          onboarding: 'onboarding',
          probation: 'probation',
          transfer: 'employeeTransfer',
          attendance_appeal: 'attendanceAppeal',
          reward_punishment: 'employeeReward',
          cert_request: 'certificateRequest',
        };
        const model = modelMap[workflowCode];
        if (!model) return;

        const record = await (this.prisma as any)[model].findFirst({
          where: { approvalInstanceId: instanceId },
        });
        if (!record) return;
        if (record.status === 'pending') return;

        await this.prisma.$transaction(async (tx) => {
          await (tx as any)[model].update({
            where: { id: record.id },
            data: { status: 'pending' },
          });
        });

        this.logger.log(`${workflowCode} 审批重提交: id=${record.id}, instanceId=${instanceId}`);
      },
      `approval.resubmitted (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  private async handleResignationApproved(instanceId: number) {
    const resignation = await this.prisma.resignation.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { employee: true },
    });
    if (!resignation) return;
    if (resignation.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.resignation.update({
        where: { id: resignation.id },
        data: { status: 'approved' },
      });
      await tx.employee.update({
        where: { id: resignation.employeeId },
        data: {
          status: EmployeeStatus.resigned,
          resignDate: resignation.resignDate,
        },
      });
    });

    this.logger.log(`离职审批通过，员工 ${resignation.employeeId} 已标记为离职`);
  }

  private async handleResignationRejected(instanceId: number) {
    const resignation = await this.prisma.resignation.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!resignation) return;
    if (resignation.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.resignation.update({
        where: { id: resignation.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`离职审批驳回，resignationId=${resignation.id}`);
  }

  private async getNextEmployeeNo(tx: any): Promise<string> {
    const seqName = 'employee_no';
    let seq = await tx.sequence.findUnique({ where: { name: seqName } });

    if (!seq) {
      const latestEmp = await tx.employee.findFirst({
        orderBy: { id: 'desc' },
        select: { employeeNo: true },
      });
      const currentMax = latestEmp
        ? parseInt(latestEmp.employeeNo.replace(/\D/g, ''), 10)
        : 0;

      seq = await tx.sequence.create({
        data: {
          name: seqName,
          currentValue: currentMax,
          step: 1,
          description: '员工编号序列',
        },
      });
    }

    await tx.$executeRaw`
      UPDATE sequences
      SET current_value = LAST_INSERT_ID(current_value + step)
      WHERE name = ${seqName}
    `;

    const result: any = await tx.$queryRaw`SELECT LAST_INSERT_ID() as next_val`;
    const nextVal = result[0]?.next_val ?? seq.currentValue + seq.step;

    return `EMP${String(nextVal).padStart(4, '0')}`;
  }

  private async handleOnboardingApproved(instanceId: number) {
    const onboarding = await this.prisma.onboarding.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!onboarding) return;
    if (onboarding.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.onboarding.update({
        where: { id: onboarding.id },
        data: { status: 'approved' },
      });

      const nextNo = await this.getNextEmployeeNo(tx);

      // 查找已有用户（手机号可能已注册，如离职返聘）
      let user = await tx.user.findUnique({ where: { username: onboarding.phone } });
      if (user) {
        // 已有用户，重新激活
        await tx.user.update({
          where: { id: user.id },
          data: {
            status: 'active',
            realName: onboarding.name,
            email: onboarding.email,
            departmentId: onboarding.departmentId,
          },
        });
        // 确保有员工角色
        const empRole = await tx.role.findFirst({ where: { code: 'employee' } });
        if (empRole) {
          const hasEmpRole = await tx.userRole.findFirst({
            where: { userId: user.id, roleId: empRole.id },
          });
          if (!hasEmpRole) {
            await tx.userRole.create({
              data: { userId: user.id, roleId: empRole.id },
            });
          }
        }
        this.logger.log(`入职审批通过，复用已有用户：userId=${user.id}, phone=${onboarding.phone}`);
      } else {
        // 创建新用户账号
        const defaultPassword = onboarding.phone.slice(-6) || '123456';
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        user = await tx.user.create({
          data: {
            username: onboarding.phone,
            passwordHash,
            realName: onboarding.name,
            phone: onboarding.phone,
            email: onboarding.email,
            departmentId: onboarding.departmentId,
            status: 'active',
          },
        });
        // 分配普通员工角色
        const empRole = await tx.role.findFirst({ where: { code: 'employee' } });
        if (empRole) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: empRole.id },
          });
        }
      }

      // 创建员工档案
      const employee = await tx.employee.create({
        data: {
          employeeNo: nextNo,
          userId: user.id,
          name: onboarding.name,
          departmentId: onboarding.departmentId,
          positionId: onboarding.positionId,
          hireDate: onboarding.hireDate,
          salary: onboarding.salary,
          phone: onboarding.phone,
          status: onboarding.probationMonths > 0 ? EmployeeStatus.probation : EmployeeStatus.active,
        },
      });

      // 有试用期时，自动创建试用期记录
      if (onboarding.probationMonths > 0) {
        const probationStartDate = onboarding.hireDate;
        const probationEndDate = new Date(onboarding.hireDate);
        probationEndDate.setMonth(probationEndDate.getMonth() + onboarding.probationMonths);

        // 幂等性判断：检查该员工是否已存在相同起止日期的试用期记录
        const existingProbation = await tx.probation.findFirst({
          where: {
            employeeId: employee.id,
            probationStartDate,
            probationEndDate,
          },
        });

        if (!existingProbation) {
          await tx.probation.create({
            data: {
              employeeId: employee.id,
              probationStartDate,
              probationEndDate,
              status: 'draft',
              remark: '入职自动创建',
            },
          });
          this.logger.log(`入职审批通过，已自动创建试用期记录：employeeId=${employee.id}`);
        } else {
          this.logger.log(`入职审批通过，试用期记录已存在，跳过创建：employeeId=${employee.id}`);
        }
      }
    });

    this.logger.log(`入职审批通过，员工 ${onboarding.name} 已创建，用户账号已初始化`);
  }

  private async handleOnboardingRejected(instanceId: number) {
    const record = await this.prisma.onboarding.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.onboarding.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`入职审批驳回，onboardingId=${record.id}`);
  }

  private async handleProbationApproved(instanceId: number) {
    const probation = await this.prisma.probation.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { employee: true },
    });
    if (!probation) return;
    if (probation.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.probation.update({
        where: { id: probation.id },
        data: { status: 'approved' },
      });
      await tx.employee.update({
        where: { id: probation.employeeId },
        data: { status: EmployeeStatus.active },
      });
    });

    this.logger.log(`转正审批通过，员工 ${probation.employeeId} 已转正`);
  }

  private async handleProbationRejected(instanceId: number) {
    const record = await this.prisma.probation.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.probation.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`转正审批驳回，probationId=${record.id}`);
  }

  private async handleTransferApproved(instanceId: number) {
    const transfer = await this.prisma.employeeTransfer.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { employee: true },
    });
    if (!transfer) return;
    if (transfer.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeTransfer.update({
        where: { id: transfer.id },
        data: { status: 'approved' },
      });
      await tx.employee.update({
        where: { id: transfer.employeeId },
        data: {
          departmentId: transfer.toDepartmentId ?? transfer.employee.departmentId,
          positionId: transfer.toPositionId ?? transfer.employee.positionId,
          salary: transfer.toSalary ?? transfer.employee.salary,
        },
      });

      // 薪资变动写入当月薪资调整
      if (transfer.toSalary && transfer.employee.salary && !transfer.toSalary.equals(transfer.employee.salary)) {
        const diff = transfer.toSalary.minus(transfer.employee.salary);
        const effectiveMonth = transfer.effectiveDate.toISOString().slice(0, 7);
        const run = await tx.payrollRun.findUnique({ where: { month: effectiveMonth } });
        if (run) {
          await tx.payrollAdjustment.create({
            data: {
              runId: run.id,
              employeeId: transfer.employeeId,
              itemCode: diff.gt(0) ? 'salary_increase' : 'salary_decrease',
              amount: diff,
              reason: `调薪${transfer.type === 'promotion' ? '（晋升）' : transfer.type === 'demotion' ? '（降职）' : ''}：从 ${transfer.employee.salary} 调整为 ${transfer.toSalary}`,
              createdBy: 0,
            },
          });
          this.logger.log(`调动调薪已写入薪资调整：employeeId=${transfer.employeeId}, diff=${diff.toString()}`);
        } else {
          this.logger.warn(
            `调动调薪但薪资账期不存在，未计入：transferId=${transfer.id}, month=${effectiveMonth}`,
          );
        }
      }
    });

    this.logger.log(`调动审批通过，员工 ${transfer.employeeId} 已调岗`);
  }

  private async handleTransferRejected(instanceId: number) {
    const record = await this.prisma.employeeTransfer.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeTransfer.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`调岗审批驳回，transferId=${record.id}`);
  }

  private async handleAppealApproved(instanceId: number) {
    const appeal = await this.prisma.attendanceAppeal.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!appeal) return;
    if (appeal.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceAppeal.update({
        where: { id: appeal.id },
        data: { status: 'approved' },
      });

      const daily = await tx.attendanceDaily.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: appeal.employeeId,
            workDate: appeal.appealDate,
          },
        },
      });
      if (daily) {
        const updateData: any = {};
        if (appeal.appealType === 'late') {
          updateData.lateMinutes = 0;
        } else if (appeal.appealType === 'early') {
          updateData.earlyMinutes = 0;
        } else if (appeal.appealType === 'absent') {
          updateData.absentMinutes = 0;
        }

        const merged = { ...daily, ...updateData };
        const newStatus = this.recalcDailyStatus(merged as any);
        if (newStatus !== daily.status) {
          updateData.status = newStatus;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.attendanceDaily.update({
            where: { id: daily.id },
            data: updateData,
          });
        }
      }
    });

    this.logger.log(`考勤申诉审批通过，申诉 ${appeal.id} 已批准，考勤已修正`);
  }

  private async handleAppealRejected(instanceId: number) {
    const record = await this.prisma.attendanceAppeal.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceAppeal.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`考勤申诉审批驳回，appealId=${record.id}`);
  }

  private async handleRewardApproved(instanceId: number) {
    const reward = await this.prisma.employeeReward.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { employee: true },
    });
    if (!reward) return;
    if (reward.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeReward.update({
        where: { id: reward.id },
        data: { status: 'approved' },
      });

      // 自动计入当月薪资调整（奖励和惩罚都计入）
      if (reward.amount && !reward.amount.equals(0)) {
        const month = reward.rewardDate.toISOString().slice(0, 7);
        const run = await tx.payrollRun.findUnique({ where: { month } });
        if (run) {
          const itemCode = reward.type === 'reward' ? 'bonus' : 'fine';
          const amount = reward.type === 'reward' ? reward.amount : reward.amount.negated();
          await tx.payrollAdjustment.create({
            data: {
              runId: run.id,
              employeeId: reward.employeeId,
              itemCode,
              amount,
              reason: `${reward.type === 'reward' ? '奖励' : '惩罚'}：${reward.category}`,
              createdBy: -1,
            },
          });
          this.logger.log(`奖惩审批通过，已计入薪资：rewardId=${reward.id}, month=${month}`);
        } else {
          this.logger.warn(
            `奖惩审批通过但薪资账期不存在，未计入薪资：rewardId=${reward.id}, month=${month}`,
          );
        }
      }
    });

    this.logger.log(`奖惩审批通过，rewardId=${reward.id}`);
  }

  private async handleRewardRejected(instanceId: number) {
    const record = await this.prisma.employeeReward.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeReward.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`奖惩审批驳回，rewardId=${record.id}`);
  }

  private async handleCertRequestApproved(instanceId: number) {
    const record = await this.prisma.certificateRequest.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'approved') return;
    await this.prisma.certificateRequest.update({
      where: { id: record.id },
      data: { status: 'approved' },
    });
    this.logger.log(`证明申请审批通过，requestId=${record.id}`);
  }

  private async handleCertRequestRejected(instanceId: number) {
    const record = await this.prisma.certificateRequest.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.certificateRequest.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });

    this.logger.log(`证明申请审批驳回，requestId=${record.id}`);
  }

  private recalcDailyStatus(daily: {
    lateMinutes: number;
    earlyMinutes: number;
    absentMinutes: number;
    leaveDays: any;
    status: string;
  }): string {
    if (daily.leaveDays && daily.leaveDays.gt && daily.leaveDays.gt(0)) return 'leave';
    if (daily.absentMinutes && daily.absentMinutes > 0) return 'absent';
    const hasLate = daily.lateMinutes > 0;
    const hasEarly = daily.earlyMinutes > 0;
    if (hasLate && hasEarly) return 'late_early';
    if (hasLate) return 'late';
    if (hasEarly) return 'early';
    return 'normal';
  }

  async getTimeline(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    employeeId?: number;
    userId: number;
  }) {
    const { page = 1, pageSize = 20, keyword, type, dateFrom, dateTo, employeeId, userId } = params;

    // 1) 数据范围：可见员工 id 集合
    const scope = await this.dataScope.visibleScope(userId);
    let visibleEmployees: { id: number; departmentId: number }[] | null = null;
    if (!scope.all) {
      visibleEmployees = scope.ids.length > 0
        ? await this.prisma.employee.findMany({ where: { departmentId: { in: scope.ids } }, select: { id: true, departmentId: true } })
        : [];
    }
    const scopeWhere = (field = 'employeeId') => {
      if (scope.all) return {};
      if (visibleEmployees === null) return {};
      const ids = visibleEmployees.map((e) => e.id);
      if (scope.selfEmployeeId && !(scope.ids.length > 0)) return { [field]: scope.selfEmployeeId };
      return ids.length ? { [field]: { in: ids } } : { [field]: { in: [] } };
    };

    // 2) 员工（入职 + 离职基准）
    const employeesQuery = {
      where: employeeId ? { id: employeeId } : scopeWhere('id'),
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    };
    const employees = await this.prisma.employee.findMany(employeesQuery as any);

    // 3) 调动/晋升/晋级（已生效记录）
    const transferWhere: any = { status: { in: ['approved', 'completed'] } };
    if (employeeId) transferWhere.employeeId = employeeId;
    else Object.assign(transferWhere, scopeWhere('employeeId'));
    const transfers = await this.prisma.employeeTransfer.findMany({
      where: transferWhere,
      include: { employee: { select: { id: true, name: true, employeeNo: true, departmentId: true } } },
    });

    // 4) 离职原因（来自离职单，兜底到各员工）
    const resignWhere: any = { status: { in: ['approved', 'completed'] } };
    if (employeeId) resignWhere.employeeId = employeeId;
    else Object.assign(resignWhere, scopeWhere('employeeId'));
    const resignations = await this.prisma.resignation.findMany({
      where: resignWhere,
      include: { employee: { select: { id: true, name: true, employeeNo: true, departmentId: true } } },
    });

    // 解析部门/职位名称
    const deptIds = new Set<number>();
    const posIds = new Set<number>();
    for (const t of transfers) {
      if (t.fromDepartmentId) deptIds.add(t.fromDepartmentId);
      if (t.toDepartmentId) deptIds.add(t.toDepartmentId);
      if (t.fromPositionId) posIds.add(t.fromPositionId);
      if (t.toPositionId) posIds.add(t.toPositionId);
    }
    const deptMap = new Map<number, string>();
    if (deptIds.size) {
      const depts = await this.prisma.department.findMany({ where: { id: { in: Array.from(deptIds) } }, select: { id: true, name: true } });
      depts.forEach((d) => deptMap.set(d.id, d.name));
    }
    const posMap = new Map<number, string>();
    if (posIds.size) {
      const poss = await this.prisma.position.findMany({ where: { id: { in: Array.from(posIds) } }, select: { id: true, name: true } });
      poss.forEach((p) => posMap.set(p.id, p.name));
    }

    // 变动摘要文本：优先部门，其次职位，可叠加
    const placeText = (deptId?: number | null, posId?: number | null): string | undefined => {
      const parts: string[] = [];
      if (deptId && deptMap.has(deptId)) parts.push(deptMap.get(deptId)!);
      if (posId && posMap.has(posId)) parts.push(posMap.get(posId)!);
      return parts.length ? parts.join('/') : undefined;
    };

    return buildTimeline(
      {
        employees: employees.map((e: any) => ({
          id: e.id,
          name: e.name,
          employeeNo: e.employeeNo,
          status: e.status,
          hireDate: e.hireDate,
          resignDate: e.resignDate,
          department: e.department?.name ?? null,
          position: e.position?.name ?? null,
        })),
        transfers: transfers.map((t: any) => ({
          id: t.id,
          employeeId: t.employeeId,
          employeeName: t.employee.name,
          employeeNo: t.employee.employeeNo,
          type: t.type,
          effectiveDate: t.effectiveDate,
          fromText: placeText(t.fromDepartmentId, t.fromPositionId),
          toText: placeText(t.toDepartmentId, t.toPositionId),
          reason: t.reason || undefined,
        })),
        resignations: resignations.map((r: any) => ({
          id: r.id,
          employeeId: r.employeeId,
          employeeName: r.employee?.name ?? '',
          employeeNo: (r.employee?.employeeNo as string) ?? '',
          resignDate: r.resignDate,
          reason: r.reason || undefined,
        })),
      },
      { keyword, type, dateFrom, dateTo, employeeId, page, pageSize },
    );
  }

  private async applyEmployeeScope(where: any, userId: number) {
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.all) return;
    if (scope.ids.length > 0) {
      const employees = await this.prisma.employee.findMany({
        where: { departmentId: { in: scope.ids } },
        select: { id: true },
      });
      const employeeIds = employees.map((e) => e.id);
      if (where.employeeId) {
        if (typeof where.employeeId === 'number') {
          if (!employeeIds.includes(where.employeeId)) {
            where.employeeId = { in: [] };
          }
        } else if (where.employeeId && typeof where.employeeId === 'object' && 'in' in where.employeeId) {
          where.employeeId.in = where.employeeId.in.filter((id: number) => employeeIds.includes(id));
        }
      } else {
        where.employeeId = { in: employeeIds };
      }
    } else if (scope.selfEmployeeId) {
      if (where.employeeId) {
        if (typeof where.employeeId === 'number') {
          if (where.employeeId !== scope.selfEmployeeId) {
            where.employeeId = { in: [] };
          }
        } else if (where.employeeId && typeof where.employeeId === 'object' && 'in' in where.employeeId) {
          where.employeeId.in = where.employeeId.in.filter((id: number) => id === scope.selfEmployeeId);
        }
      } else {
        where.employeeId = scope.selfEmployeeId;
      }
    } else {
      where.employeeId = { in: [] };
    }
  }

  private async applyDepartmentScope(where: any, userId: number, field = 'departmentId') {
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.all) return;
    if (scope.ids.length > 0) {
      where[field] = { in: scope.ids };
    } else {
      where[field] = { in: [] };
    }
  }
}
