import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_CODES } from '../common/error-codes';
import { errorCode } from '../common/error.util';

// 员工标签入参
export interface EmployeeTagUpsertDto {
  name: string;
  color?: string;
  sortOrder?: number;
}

@Injectable()
export class EmployeeTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const list = await this.prisma.employeeTag.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return { list, total: list.length };
  }

  async create(dto: EmployeeTagUpsertDto) {
    try {
      return await this.prisma.employeeTag.create({
        data: {
          name: dto.name,
          color: dto.color,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (errorCode(e) === 'P2002') {
        throw new ConflictException({ code: ERROR_CODES.EMPLOYEE_TAG_NAME_EXISTS, message: '标签名称已存在' });
      }
      throw e;
    }
  }

  async update(id: number, dto: Partial<EmployeeTagUpsertDto>) {
    const tag = await this.prisma.employeeTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_TAG_NOT_FOUND, message: '标签不存在' });
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if (dto[key as keyof EmployeeTagUpsertDto] !== undefined) {
        data[key] = dto[key as keyof EmployeeTagUpsertDto];
      }
    }
    try {
      return await this.prisma.employeeTag.update({ where: { id }, data });
    } catch (e) {
      if (errorCode(e) === 'P2002') {
        throw new ConflictException({ code: ERROR_CODES.EMPLOYEE_TAG_NAME_EXISTS, message: '标签名称已存在' });
      }
      throw e;
    }
  }

  async remove(id: number) {
    const tag = await this.prisma.employeeTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_TAG_NOT_FOUND, message: '标签不存在' });
    await this.prisma.employeeTag.delete({ where: { id } });
    return { success: true };
  }
}