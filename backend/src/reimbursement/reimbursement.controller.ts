import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ReimbursementService } from './reimbursement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reimbursements')
@UseGuards(JwtAuthGuard)
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Get('types')
  async listTypes() {
    const data = await this.reimbursementService.listTypes();
    return { code: 0, data };
  }

  @Post()
  @HttpCode(200)
  async create(@Body() body: any, @Req() req: any) {
    const data = await this.reimbursementService.create({
      userId: req.user.id,
      typeCode: body.typeCode,
      title: body.title,
      description: body.description,
      totalAmount: body.totalAmount,
      items: body.items,
    });
    return { code: 0, data };
  }

  @Get('mine')
  async listMine(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Req() req: any,
  ) {
    const data = await this.reimbursementService.listMine(
      req.user.id,
      Number(page),
      Number(pageSize),
    );
    return { code: 0, data };
  }

  @Get('pending')
  async listPending(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Req() req: any,
  ) {
    const data = await this.reimbursementService.listPending(
      req.user.id,
      Number(page),
      Number(pageSize),
    );
    return { code: 0, data };
  }

  @Get(':id')
  async getDetail(@Param('id') id: string, @Req() req: any) {
    const data = await this.reimbursementService.getDetail(Number(id), req.user.id);
    return { code: 0, data };
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(@Param('id') id: string, @Req() req: any) {
    const data = await this.reimbursementService.submit(Number(id), req.user.id);
    return { code: 0, data };
  }
}
