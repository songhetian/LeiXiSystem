import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [PrismaModule, AuthModule, EmployeesModule],
  controllers: [HealthController],
})
export class AppModule {}
