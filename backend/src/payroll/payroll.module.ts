import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayslipController } from './payslip.controller';
import { PayslipService } from './payslip.service';

@Module({
  controllers: [PayrollController, PayslipController],
  providers: [PayrollService, PayslipService],
  exports: [PayrollService, PayslipService],
})
export class PayrollModule {}
