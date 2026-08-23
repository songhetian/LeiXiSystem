import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { OkrController } from './okr.controller';
import { PerformanceService } from './performance.service';
import { OkrService } from './okr.service';

// 绩效/OKR 模块：提供绩效周期、目标、评估及 OKR 目标/关键结果接口
@Module({
  controllers: [PerformanceController, OkrController],
  providers: [PerformanceService, OkrService],
  exports: [PerformanceService, OkrService],
})
export class PerformanceModule {}