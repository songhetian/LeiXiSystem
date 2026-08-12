import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { EmployeesController } from './employees/employees.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController, EmployeesController],
})
export class AppModule {}
