import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 打卡定位入参
export interface AttendanceLocationUpsertDto {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius?: number;
  workType?: string;
  enabled?: boolean;
}

@Injectable()
export class AttendanceLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const list = await this.prisma.attendanceLocation.findMany({ orderBy: { id: 'asc' } });
    return { list, total: list.length };
  }

  async create(dto: AttendanceLocationUpsertDto) {
    return await this.prisma.attendanceLocation.create({
      data: {
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        radius: dto.radius ?? 100,
        workType: dto.workType ?? 'office',
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(id: number, dto: Partial<AttendanceLocationUpsertDto>) {
    const location = await this.prisma.attendanceLocation.findUnique({ where: { id } });
    if (!location) throw new NotFoundException({ code: 2001, message: '打卡定位不存在' });
    const data: Record<string, any> = {};
    for (const key of Object.keys(dto)) {
      if (dto[key as keyof AttendanceLocationUpsertDto] !== undefined) {
        data[key] = dto[key as keyof AttendanceLocationUpsertDto];
      }
    }
    return await this.prisma.attendanceLocation.update({ where: { id }, data });
  }

  async remove(id: number) {
    const location = await this.prisma.attendanceLocation.findUnique({ where: { id } });
    if (!location) throw new NotFoundException({ code: 2001, message: '打卡定位不存在' });
    await this.prisma.attendanceLocation.delete({ where: { id } });
    return { success: true };
  }
}