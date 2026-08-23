import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PunchMakeupService } from './punch-makeup.service';
import { parsePagination } from '../common/pagination.util';

@Controller('attendance/punch/makeup')
@UseGuards(JwtAuthGuard)
export class PunchMakeupController {
  constructor(private readonly punchMakeupService: PunchMakeupService) {}

  @Get()
  @HttpCode(200)
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.punchMakeupService.list({
      page: pageNum,
      pageSize: pageSizeNum,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      status,
      startDate,
      endDate,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get(':id')
  @HttpCode(200)
  async detail(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.punchMakeupService.detail(id, req.user.id);
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  async create(
    @Body() body: {
      punchDate: string;
      punchType: string;
      originalTime?: string;
      makeupTime?: string;
      reason: string;
    },
    @Req() req: any,
  ) {
    const data = await this.punchMakeupService.create({
      ...body,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      punchDate?: string;
      punchType?: string;
      originalTime?: string;
      makeupTime?: string;
      reason?: string;
    },
    @Req() req: any,
  ) {
    const data = await this.punchMakeupService.update(id, req.user.id, body);
    return { code: 0, data };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.punchMakeupService.remove(id, req.user.id);
    return { code: 0, data };
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.punchMakeupService.submit(id, req.user.id);
    return { code: 0, data };
  }
}
