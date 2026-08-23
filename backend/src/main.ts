import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

dotenv.config({ path: '.env' });

const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  // 安全头（Helmet）
  // 注意：styleSrc 的 'unsafe-inline' 是 Arco Design / Ant Design 系列的已知需求，
  //       scriptSrc 默认不含 'unsafe-inline'，生产环境下更严格。
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'sameorigin' },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  await app.register(cookie as any);

  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:8088,http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  });

  app.setGlobalPrefix('api/v1', { exclude: ['iclock/cdata'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('雷犀管理系统 API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, swaggerDocument, {
      swaggerOptions: { persistAuthorization: true },
    });
    new Logger('Swagger').log('API 文档已启用: http://localhost:4001/api/v1/docs');
  }

  // Graceful Shutdown：接收 SIGTERM/SIGINT 时优雅关闭
  app.enableShutdownHooks(['SIGTERM', 'SIGINT', 'SIGQUIT']);

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`服务已启动: http://localhost:${port}`);

  process.on('unhandledRejection', (reason: unknown) => {
    new Logger('UnhandledRejection').error(
      reason instanceof Error ? reason.stack : String(reason),
    );
  });

  process.on('uncaughtException', (err: Error) => {
    new Logger('UncaughtException').error(err.stack || err.message);
    process.exit(1);
  });
}
bootstrap();
