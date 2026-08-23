import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeeTxController } from './employee-tx.controller';
import { EmployeeTagsController } from './employee-tags.controller';
import { AttendanceLocationsController } from './attendance-locations.controller';
import { EmployeesService } from './employees.service';
import { EmployeeTxService } from './employee-tx.service';
import { EmployeeTagsService } from './employee-tags.service';
import { AttendanceLocationsService } from './attendance-locations.service';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [ApprovalModule],
  controllers: [EmployeesController, EmployeeTxController, EmployeeTagsController, AttendanceLocationsController],
  providers: [EmployeesService, EmployeeTxService, EmployeeTagsService, AttendanceLocationsService],
  exports: [EmployeesService, EmployeeTxService, EmployeeTagsService, AttendanceLocationsService],
})
export class EmployeesModule {}
