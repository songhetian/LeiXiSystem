import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  ParseIntPipe,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { EmployeeTxService } from './employee-tx.service';
import { EmployeesService } from './employees.service';
import { parsePagination } from '../common/pagination.util';
import { ERROR_CODES } from '../common/error-codes';

const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式错误').optional().or(z.literal('').transform(() => undefined));

const updateMyProfileSchema = z.object({
  phone: phoneSchema,
  address: z.string().optional(),
  email: z.string().email('邮箱格式错误').optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

@ApiTags('员工事务')
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeTxController {
  constructor(
    private readonly txService: EmployeeTxService,
    private readonly employeesService: EmployeesService,
  ) {}

  // ===== 入职登记 =====
  @Get('onboarding')
  @HttpCode(200)
  @RequirePermission('onboarding:view')
  async listOnboarding(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listOnboarding({
      page: pageNum,
      pageSize: pageSizeNum,
      status, keyword,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('onboarding')
  @HttpCode(200)
  @RequirePermission('onboarding:manage')
  async createOnboarding(@Body() body: any, @Req() req: any) {
    const data = await this.txService.createOnboarding(body, req.user.id);
    return { code: 0, data };
  }

  @Put('onboarding/:id')
  @HttpCode(200)
  @RequirePermission('onboarding:manage')
  async updateOnboarding(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateOnboarding(id, body);
    return { code: 0, data };
  }

  @Delete('onboarding/:id')
  @HttpCode(200)
  @RequirePermission('onboarding:manage')
  async deleteOnboarding(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteOnboarding(id);
    return { code: 0, data };
  }

  @Post('onboarding/:id/submit')
  @HttpCode(200)
  @RequirePermission('onboarding:manage')
  async submitOnboarding(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitOnboarding(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  // ===== 离职申请 =====
  @Get('resignations')
  @HttpCode(200)
  @RequirePermission('resignation:view')
  async listResignations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listResignations({
      page: pageNum,
      pageSize: pageSizeNum,
      status,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('resignations')
  @HttpCode(200)
  @RequirePermission('resignation:apply')
  async createResignation(@Body() body: any, @Req() req: any) {
    const data = await this.txService.createResignation(body, req.user.id);
    return { code: 0, data };
  }

  @Put('resignations/:id')
  @HttpCode(200)
  @RequirePermission('resignation:apply')
  async updateResignation(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.updateResignation(id, body, req.user.id);
    return { code: 0, data };
  }

  @Delete('resignations/:id')
  @HttpCode(200)
  @RequirePermission('resignation:apply')
  async deleteResignation(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.deleteResignation(id, req.user.id);
    return { code: 0, data };
  }

  @Post('resignations/:id/submit')
  @HttpCode(200)
  @RequirePermission('resignation:apply')
  async submitResignation(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitResignation(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  // ===== 转正申请 =====
  @Get('probations')
  @HttpCode(200)
  @RequirePermission('probation:view')
  async listProbations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listProbations({
      page: pageNum,
      pageSize: pageSizeNum,
      status,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('probations')
  @HttpCode(200)
  @RequirePermission('probation:manage')
  async createProbation(@Body() body: any) {
    const data = await this.txService.createProbation(body);
    return { code: 0, data };
  }

  @Put('probations/:id')
  @HttpCode(200)
  @RequirePermission('probation:manage')
  async updateProbation(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateProbation(id, body);
    return { code: 0, data };
  }

  @Delete('probations/:id')
  @HttpCode(200)
  @RequirePermission('probation:manage')
  async deleteProbation(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteProbation(id);
    return { code: 0, data };
  }

  @Post('probations/:id/submit')
  @HttpCode(200)
  @RequirePermission('probation:apply')
  async submitProbation(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitProbation(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  // ===== 合同管理 =====
  @Get('contracts')
  @HttpCode(200)
  @RequirePermission('contract:view')
  async listContracts(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('keyword') keyword?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listContracts({
      page: pageNum,
      pageSize: pageSizeNum,
      status,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      keyword,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('contracts')
  @HttpCode(200)
  @RequirePermission('contract:manage')
  async createContract(@Body() body: any) {
    const data = await this.txService.createContract(body);
    return { code: 0, data };
  }

  @Put('contracts/:id')
  @HttpCode(200)
  @RequirePermission('contract:manage')
  async updateContract(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateContract(id, body);
    return { code: 0, data };
  }

  @Delete('contracts/:id')
  @HttpCode(200)
  @RequirePermission('contract:manage')
  async deleteContract(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteContract(id);
    return { code: 0, data };
  }

  // ===== 考勤申诉 =====
  @Get('appeals')
  @HttpCode(200)
  @RequirePermission('attendance:appeal:view')
  async listAppeals(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listAppeals({
      page: pageNum,
      pageSize: pageSizeNum,
      status,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('appeals')
  @HttpCode(200)
  @RequirePermission('attendance:appeal:apply')
  async createAppeal(@Body() body: any, @Req() req: any) {
    const data = await this.txService.createAppeal(body, req.user.id);
    return { code: 0, data };
  }

  @Put('appeals/:id')
  @HttpCode(200)
  @RequirePermission('attendance:appeal:apply')
  async updateAppeal(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.updateAppeal(id, body, req.user.id);
    return { code: 0, data };
  }

  @Delete('appeals/:id')
  @HttpCode(200)
  @RequirePermission('attendance:appeal:apply')
  async deleteAppeal(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.deleteAppeal(id, req.user.id);
    return { code: 0, data };
  }

  @Post('appeals/:id/submit')
  @HttpCode(200)
  @RequirePermission('attendance:appeal:apply')
  async submitAppeal(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitAppeal(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  // ===== 证书管理 =====
  @Get('certificates')
  @HttpCode(200)
  @RequirePermission('certificate:view')
  async listCertificates(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('employeeId') employeeId?: string,
    @Query('keyword') keyword?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listCertificates({
      page: pageNum,
      pageSize: pageSizeNum,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      keyword,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('certificates')
  @HttpCode(200)
  @RequirePermission('certificate:manage')
  async createCertificate(@Body() body: any) {
    const data = await this.txService.createCertificate(body);
    return { code: 0, data };
  }

  @Put('certificates/:id')
  @HttpCode(200)
  @RequirePermission('certificate:manage')
  async updateCertificate(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateCertificate(id, body);
    return { code: 0, data };
  }

  @Delete('certificates/:id')
  @HttpCode(200)
  @RequirePermission('certificate:manage')
  async deleteCertificate(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteCertificate(id);
    return { code: 0, data };
  }

  // ===== 奖惩记录 =====
  @Get('rewards')
  @HttpCode(200)
  @RequirePermission('reward:view')
  async listRewards(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listRewards({
      page: pageNum,
      pageSize: pageSizeNum,
      type,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get('rewards/export')
  @HttpCode(200)
  @RequirePermission('reward:view')
  async exportRewards(
    @Req() req: any,
    @Res() res: FastifyReply,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const buffer = await this.txService.exportRewards(req.user.id, {
      type,
      startDate,
      endDate,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
    });
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename="rewards_${Date.now()}.xlsx"`);
    res.send(buffer);
  }

  @Post('rewards')
  @HttpCode(200)
  @RequirePermission('reward:manage')
  async createReward(@Body() body: any) {
    const data = await this.txService.createReward(body);
    return { code: 0, data };
  }

  @Put('rewards/:id')
  @HttpCode(200)
  @RequirePermission('reward:manage')
  async updateReward(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateReward(id, body);
    return { code: 0, data };
  }

  @Delete('rewards/:id')
  @HttpCode(200)
  @RequirePermission('reward:manage')
  async deleteReward(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteReward(id);
    return { code: 0, data };
  }

  @Post('rewards/:id/submit')
  @HttpCode(200)
  @RequirePermission('reward:manage')
  async submitReward(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitReward(id, req.user.id, body.workflowCode, { checkOwnership: false });
    return { code: 0, data };
  }

  // ===== 证明申请 =====
  @Get('cert-requests')
  @HttpCode(200)
  @RequirePermission('cert_request:view')
  async listCertRequests(@Query() query: any, @Req() req: any) {
    const data = await this.txService.listCertRequests({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      type: query.type,
      status: query.status,
      employeeId: query.employeeId ? Number(query.employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get('cert-requests/:id')
  @HttpCode(200)
  @RequirePermission('cert_request:view')
  async getCertRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.getCertRequest(id, req.user.id, { checkOwnership: false });
    return { code: 0, data };
  }

  @Post('cert-requests')
  @HttpCode(200)
  @RequirePermission('cert_request:manage')
  async createCertRequest(@Body() body: any, @Req() req: any) {
    const data = await this.txService.createCertRequest(body, req.user.id, { checkOwnership: false });
    return { code: 0, data };
  }

  @Put('cert-requests/:id')
  @HttpCode(200)
  @RequirePermission('cert_request:manage')
  async updateCertRequest(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.updateCertRequest(id, body, req.user.id, { checkOwnership: false });
    return { code: 0, data };
  }

  @Delete('cert-requests/:id')
  @HttpCode(200)
  @RequirePermission('cert_request:manage')
  async deleteCertRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.deleteCertRequest(id, req.user.id, { checkOwnership: false });
    return { code: 0, data };
  }

  @Post('cert-requests/:id/submit')
  @HttpCode(200)
  @RequirePermission('cert_request:manage')
  async submitCertRequest(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitCertRequest(id, req.user.id, body.workflowCode, { checkOwnership: false });
    return { code: 0, data };
  }

  @Post('cert-requests/:id/complete')
  @HttpCode(200)
  @RequirePermission('cert_request:manage')
  async markCertRequestCompleted(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.markCertRequestCompleted(id, req.user.id);
    return { code: 0, data };
  }

  @Post('cert-requests/:id/cancel')
  @HttpCode(200)
  @RequirePermission('cert_request:manage')
  async cancelCertRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.cancelCertRequest(id, req.user.id, { checkOwnership: false });
    return { code: 0, data };
  }

  // ===== 培训记录 =====
  @Get('trainings')
  @HttpCode(200)
  @RequirePermission('training:view')
  async listTrainings(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listTrainings({
      page: pageNum,
      pageSize: pageSizeNum,
      category,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('trainings')
  @HttpCode(200)
  @RequirePermission('training:manage')
  async createTraining(@Body() body: any) {
    const data = await this.txService.createTraining(body);
    return { code: 0, data };
  }

  @Put('trainings/:id')
  @HttpCode(200)
  @RequirePermission('training:manage')
  async updateTraining(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateTraining(id, body);
    return { code: 0, data };
  }

  @Delete('trainings/:id')
  @HttpCode(200)
  @RequirePermission('training:manage')
  async deleteTraining(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteTraining(id);
    return { code: 0, data };
  }

  // ===== 调岗调薪 =====
  @Get('timeline')
  @HttpCode(200)
  @RequirePermission('transfer:view')
  async getTimeline(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('type') type?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.getTimeline({
      page: pageNum,
      pageSize: pageSizeNum,
      keyword, type, dateFrom, dateTo,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get('transfers')
  @HttpCode(200)
  @RequirePermission('transfer:view')
  async listTransfers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Req() req?: any,
  ) {
    const { page: pageNum, pageSize: pageSizeNum } = parsePagination({ page, pageSize });
    const data = await this.txService.listTransfers({
      page: pageNum,
      pageSize: pageSizeNum,
      type, status,
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('transfers')
  @HttpCode(200)
  @RequirePermission('transfer:manage')
  async createTransfer(@Body() body: any) {
    const data = await this.txService.createTransfer(body);
    return { code: 0, data };
  }

  @Put('transfers/:id')
  @HttpCode(200)
  @RequirePermission('transfer:manage')
  async updateTransfer(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.txService.updateTransfer(id, body);
    return { code: 0, data };
  }

  @Delete('transfers/:id')
  @HttpCode(200)
  @RequirePermission('transfer:manage')
  async deleteTransfer(@Param('id', ParseIntPipe) id: number) {
    const data = await this.txService.deleteTransfer(id);
    return { code: 0, data };
  }

  @Post('transfers/:id/submit')
  @HttpCode(200)
  @RequirePermission('transfer:manage')
  async submitTransfer(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitTransfer(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  // ===== 员工自助 =====
  @Get('me/profile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    return { code: 0, data: emp };
  }

  @Put('me/profile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(@Body() body: unknown, @Req() req: any) {
    const parsed = updateMyProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '参数校验失败' });
    }
    const data = await this.employeesService.updateMyProfile(req.user.id, parsed.data);
    return { code: 0, data };
  }

  @Get('me/resignations')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async listMyResignations(@Query() query: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) return { code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } };
    const data = await this.txService.listResignations({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      status: query.status,
      employeeId: emp.id,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('me/resignations')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async createMyResignation(@Body() body: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) throw new BadRequestException({ code: 9101, message: '员工档案不存在' });
    const data = await this.txService.createResignation({ ...body, employeeId: emp.id }, req.user.id);
    return { code: 0, data };
  }

  @Post('me/resignations/:id/submit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async submitMyResignation(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitResignation(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  @Get('me/appeals')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async listMyAppeals(@Query() query: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) return { code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } };
    const data = await this.txService.listAppeals({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      status: query.status,
      employeeId: emp.id,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('me/appeals')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async createMyAppeal(@Body() body: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) throw new BadRequestException({ code: 9404, message: '员工档案不存在' });
    const data = await this.txService.createAppeal({ ...body, employeeId: emp.id }, req.user.id);
    return { code: 0, data };
  }

  @Post('me/appeals/:id/submit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async submitMyAppeal(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitAppeal(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  @Get('me/rewards')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async listMyRewards(@Query() query: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) return { code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } };
    const data = await this.txService.listRewards({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      type: query.type,
      employeeId: emp.id,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get('me/trainings')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async listMyTrainings(@Query() query: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) return { code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } };
    const data = await this.txService.listTrainings({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      category: query.category,
      employeeId: emp.id,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Get('me/cert-requests')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async listMyCertRequests(@Query() query: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) return { code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } };
    const data = await this.txService.listCertRequests({
      page: Number(query.page),
      pageSize: Number(query.pageSize),
      type: query.type,
      status: query.status,
      employeeId: emp.id,
      userId: req.user.id,
    });
    return { code: 0, data };
  }

  @Post('me/cert-requests')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async createMyCertRequest(@Body() body: any, @Req() req: any) {
    const emp = await this.txService.getEmployeeByUserId(req.user.id);
    if (!emp) throw new BadRequestException({ code: 9801, message: '员工档案不存在' });
    const data = await this.txService.createCertRequest({ ...body, employeeId: emp.id }, req.user.id);
    return { code: 0, data };
  }

  @Post('me/cert-requests/:id/submit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async submitMyCertRequest(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    const data = await this.txService.submitCertRequest(id, req.user.id, body.workflowCode);
    return { code: 0, data };
  }

  @Post('me/cert-requests/:id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async cancelMyCertRequest(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const data = await this.txService.cancelCertRequest(id, req.user.id);
    return { code: 0, data };
  }
}
