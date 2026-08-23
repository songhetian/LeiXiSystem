import { Controller, Get, Res } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import type { FastifyReply } from 'fastify';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: FastifyReply) {
    const metrics = await this.metrics.getMetrics();
    res.header('Content-Type', this.metrics.getContentType());
    res.send(metrics);
  }
}
