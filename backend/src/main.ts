import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(cookie);
  app.setGlobalPrefix('api/v1');
  await app.listen(3001, '0.0.0.0');
  console.log('[server] listening on http://localhost:3001');
}
bootstrap();
