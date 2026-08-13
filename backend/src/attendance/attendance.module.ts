import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { PunchLogsController } from './punch-logs.controller';
import { PunchLogsService } from './punch-logs.service';
import { PunchSyncService } from './punch-sync.service';
import { VacationService } from './vacation.service';
import { VacationController } from './vacation.controller';
import { LeaveRecordsController } from './leave-records.controller';
import { OvertimeRecordsController } from './overtime-records.controller';
import { AttendanceDailyService } from './attendance-daily.service';
import { AttendanceDailyController } from './attendance-daily.controller';
import { AttendanceMonthlyService } from './attendance-monthly.service';
import { AttendanceMonthlyController } from './attendance-monthly.controller';
import { AttendanceDailyRecalcService } from './attendance-daily-recalc.service';
import { PunchMakeupService } from './punch-makeup.service';
import { PunchMakeupController } from './punch-makeup.controller';
import { PunchDeviceService } from './punch-device.service';
import { PunchDeviceController } from './punch-device.controller';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [ApprovalModule],
  controllers: [
    ShiftsController,
    SchedulesController,
    PunchLogsController,
    VacationController,
    LeaveRecordsController,
    OvertimeRecordsController,
    AttendanceDailyController,
    AttendanceMonthlyController,
    PunchMakeupController,
    PunchDeviceController,
  ],
  providers: [
    ShiftsService,
    SchedulesService,
    PunchLogsService,
    PunchSyncService,
    VacationService,
    AttendanceDailyService,
    AttendanceDailyRecalcService,
    AttendanceMonthlyService,
    PunchMakeupService,
    PunchDeviceService,
  ],
  exports: [
    ShiftsService,
    SchedulesService,
    PunchLogsService,
    PunchSyncService,
    VacationService,
    AttendanceDailyService,
    AttendanceDailyRecalcService,
    AttendanceMonthlyService,
    PunchMakeupService,
    PunchDeviceService,
  ],
})
export class AttendanceModule {}
