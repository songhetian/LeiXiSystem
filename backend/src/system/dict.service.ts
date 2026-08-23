import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DictService {
  constructor(private readonly prisma: PrismaService) {}

  async listTypes(params: { page?: number; pageSize?: number; keyword?: string }) {
    const { page = 1, pageSize = 20, keyword } = params;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { code: { contains: keyword } },
        { name: { contains: keyword } },
      ];
    }
    const [list, total] = await Promise.all([
      this.prisma.dictType.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'desc' },
      }),
      this.prisma.dictType.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async allTypes() {
    return this.prisma.dictType.findMany({
      where: { status: 'enabled' },
      orderBy: { id: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async createType(dto: { code: string; name: string; description?: string; status?: string }) {
    const exists = await this.prisma.dictType.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException({ code: 8001, message: '字典编码已存在' });
    return this.prisma.dictType.create({ data: dto });
  }

  async updateType(id: number, dto: { name?: string; description?: string; status?: string }) {
    const type = await this.prisma.dictType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException({ code: 8002, message: '字典类型不存在' });
    return this.prisma.dictType.update({ where: { id }, data: dto });
  }

  async deleteType(id: number) {
    const type = await this.prisma.dictType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException({ code: 8002, message: '字典类型不存在' });
    await this.prisma.dictType.delete({ where: { id } });
    return { success: true };
  }

  async listItems(typeId: number) {
    return this.prisma.dictItem.findMany({
      where: { typeId, status: 'enabled' },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
  }

  async listItemsByCode(code: string) {
    const type = await this.prisma.dictType.findUnique({ where: { code } });
    if (!type) return [];
    return this.prisma.dictItem.findMany({
      where: { typeId: type.id, status: 'enabled' },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
  }

  async createItem(dto: { typeId: number; label: string; value: string; sort?: number; status?: string; remark?: string }) {
    const type = await this.prisma.dictType.findUnique({ where: { id: dto.typeId } });
    if (!type) throw new NotFoundException({ code: 8002, message: '字典类型不存在' });
    return this.prisma.dictItem.create({ data: dto });
  }

  async updateItem(id: number, dto: { label?: string; value?: string; sort?: number; status?: string; remark?: string }) {
    const item = await this.prisma.dictItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: 8003, message: '字典项不存在' });
    return this.prisma.dictItem.update({ where: { id }, data: dto });
  }

  async deleteItem(id: number) {
    const item = await this.prisma.dictItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: 8003, message: '字典项不存在' });
    await this.prisma.dictItem.delete({ where: { id } });
    return { success: true };
  }
}
