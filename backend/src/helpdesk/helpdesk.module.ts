import { Module } from '@nestjs/common';
import { HelpdeskTicketsController, HelpdeskSlasController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';

@Module({
  controllers: [HelpdeskTicketsController, HelpdeskSlasController],
  providers: [HelpdeskService],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}