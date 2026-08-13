import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PunchDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: {
    name: string;
    deviceNo: string;
    ipAddress: string;
    port?: number;
    apiKey?: string;
    enabled?: boolean;
  }) {
    try {
      return await this.prisma.punchDevice.create({ data: dto });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2007, message: '设备编号已存在' });
      }
      throw e;
    }
  }

  async list() {
    const list = await this.prisma.punchDevice.findMany({ orderBy: { id: 'asc' } });
    return { list, total: list.length };
  }

  async get(id: number) {
    const device = await this.prisma.punchDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException({ code: 2007, message: '设备不存在' });
    }
    return device;
  }

  async update(
    id: number,
    dto: {
      name?: string;
      deviceNo?: string;
      ipAddress?: string;
      port?: number;
      apiKey?: string;
      enabled?: boolean;
    },
  ) {
    const device = await this.prisma.punchDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException({ code: 2007, message: '设备不存在' });
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.deviceNo !== undefined) data.deviceNo = dto.deviceNo;
    if (dto.ipAddress !== undefined) data.ipAddress = dto.ipAddress;
    if (dto.port !== undefined) data.port = dto.port;
    if (dto.apiKey !== undefined) data.apiKey = dto.apiKey;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    try {
      return await this.prisma.punchDevice.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException({ code: 2007, message: '设备编号已存在' });
      }
      throw e;
    }
  }

  async remove(id: number) {
    const device = await this.prisma.punchDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException({ code: 2007, message: '设备不存在' });
    }
    await this.prisma.punchDevice.delete({ where: { id } });
    return { success: true };
  }
}
