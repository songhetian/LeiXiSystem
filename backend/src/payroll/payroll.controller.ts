import { Controller, Get, Post, Put, Patch, Param, Body, Query, Req, UseGuards, HttpCode, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { PayrollService } from './payroll.service';
import { confirmRunSchema, type ConfirmRunDto } from './dto/confirm.dto';
import { CreateSalaryItemDto, UpdateSalaryItemDto } from './dto/salary-item.dto';
import { ToggleSalaryItemDto } from './dto/toggle-salary-item.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { AdjustRunDto } from './dto/adjust-run.dto';
import { parsePagination } from '../common/pagination.util';

@ApiTags('薪资')
@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('items')
  @HttpCode(200)
  @RequirePermission('payroll:view')
  async listItems() {
    const data = await this.payrollService.listSalaryItems();
    return { code: 0, data };
  }

  @Post('items')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async createItem(@Body() body: CreateSalaryItemDto) {
    const data = await this.payrollService.createSalaryItem({
      code: body.code,
      name: body.name,
      type: body.type,
      amount: body.amount,
      rate: body.rate,
      formula: body.formula,
      sortOrder: body.sortOrder,
    });
    return { code: 0, data };
  }

  @Put('items/:id')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async updateItem(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSalaryItemDto) {
    const data = await this.payrollService.updateSalaryItem(id, {
      name: body.name,
      type: body.type,
      amount: body.amount,
      rate: body.rate,
      formula: body.formula,
      sortOrder: body.sortOrder,
    });
    return { code: 0, data };
  }

  @Patch('items/:id')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async toggleItem(@Param('id', ParseIntPipe) id: number, @Body() body: ToggleSalaryItemDto) {
    const data = await this.payrollService.toggleSalaryItem(id, body.enabled);
    return { code: 0, data };
  }

  @Get('runs')
  @HttpCode(200)
  @RequirePermission('payroll:view')
  async listRuns(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.payrollService.listRuns({
      userId: req.user.id,
      page: pageNum,
      pageSize: pageSizeNum,
    });
    return { code: 0, data };
  }

  @Post('runs')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async createRun(@Body() body: CreateRunDto, @Req() req: any) {
    const data = await this.payrollService.createRun(body.month, req.user.id);
    return { code: 0, data };
  }

  @Get('runs/:id/details')
  @HttpCode(200)
  @RequirePermission('payroll:view')
  async details(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.payrollService.getRunDetails(id, req.user.id);
    return { code: 0, data };
  }

  @Post('runs/:id/confirm')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async confirm(@Param('id', ParseIntPipe) id: number, @Body() body: ConfirmRunDto, @Req() req: any) {
    const parsed = confirmRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 3008, message: parsed.error.errors[0].message });
    }
    const dto: ConfirmRunDto = parsed.data;
    const data = await this.payrollService.confirmRun(id, req.user.id, dto.checkedEmployeeIds);
    return { code: 0, data };
  }

  @Post('runs/:id/publish')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async publish(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.payrollService.publishRun(id, req.user.id);
    return { code: 0, data };
  }

  @Post('runs/:id/recall')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async recall(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.payrollService.recallRun(id, req.user.id);
    return { code: 0, data };
  }

  @Post('runs/:id/adjust')
  @HttpCode(200)
  @RequirePermission('payroll:manage')
  async adjust(@Param('id', ParseIntPipe) id: number, @Body() body: AdjustRunDto, @Req() req: any) {
    const data = await this.payrollService.addAdjustment(
      id,
      {
        employeeId: body.employeeId,
        itemCode: body.itemCode,
        itemName: body.itemName,
        amount: Number(body.amount),
        reason: body.reason,
      },
      req.user.id,
    );
    return { code: 0, data };
  }
}
