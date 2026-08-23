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
import { PunchService } from './punch.service';
import { PunchController } from './punch.controller';
import { XFacePushController } from './push/xface-push.controller';
import { XFacePushService } from './push/xface-push.service';
import { AttendanceSettingsService } from './settings.service';
import { AttendanceSettingsController } from './settings.controller';
import { ApprovalModule } from '../approval/approval.module';
import { NotificationModule } from '../notification/notification.module';
import { AttendanceApprovalListener } from './attendance-approval.listener';
import { ExceptionRulesController, ExceptionsController } from './exception-rules.controller';
import { ExceptionRulesService } from './exception-rules.service';
import { DeductionRulesController } from './deduction-rules.controller';
import { DeductionRulesService } from './deduction-rules.service';

@Module({
  imports: [ApprovalModule, NotificationModule],
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
    PunchController,
    XFacePushController,
    AttendanceSettingsController,
    ExceptionRulesController,
    ExceptionsController,
    DeductionRulesController,
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
    PunchService,
    XFacePushService,
    AttendanceSettingsService,
    AttendanceApprovalListener,
    ExceptionRulesService,
    DeductionRulesService,
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
    PunchService,
    AttendanceSettingsService,
    ExceptionRulesService,
    DeductionRulesService,
  ],
})
export class AttendanceModule {}
