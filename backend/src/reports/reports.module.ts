import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsCacheListener } from './reports-cache.listener';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsCacheListener],
  exports: [ReportsService],
})
export class ReportsModule {}
