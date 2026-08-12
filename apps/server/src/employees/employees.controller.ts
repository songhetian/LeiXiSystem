import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

// S02 占位：受保护 + 权限控制的示例接口（S03 完善为真实员工 CRUD）
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  @Get()
  @RequirePermission('employee:list')
  list() {
    return { code: 0, message: 'ok', data: { list: [], total: 0, page: 1, pageSize: 20 } };
  }
}
