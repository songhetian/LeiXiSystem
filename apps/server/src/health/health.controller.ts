import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { code: 0, message: 'ok', data: { status: 'up' } };
  }
}
