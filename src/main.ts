import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as helmet from 'helmet';
import { json, urlencoded, raw } from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { join } from 'path';
import * as fs from 'fs';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const corsOrigins = (config.get<string>('cors.origins') || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true
  });
  app.use(helmet.default());
  const globalPrefix = 'v1';
  app.setGlobalPrefix(globalPrefix);
  const stripeWebhookPath = `/${globalPrefix}/subscriptions/webhooks/stripe`;
  app.use(
    stripeWebhookPath,
    raw({ type: 'application/json' }),
    (req, _res, next) => {
      (req as any).rawBody = req.body;
      next();
    }
  );
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(RequestIdMiddleware);
  app.use(RequestLoggerMiddleware);

  const uploadDir = config.get<string>('files.uploadDir');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('uploadDir', uploadDir);
  app.use('/files', (await import('express')).static(join(process.cwd(), uploadDir)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerDocument = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup('docs', app, swaggerDocument);

  const desired = config.get<number>('app.port') || 3000;

  async function listenWithFallback(startPort: number, attempts = 5) {
    let port = startPort;
    for (let i = 0; i < attempts; i++) {
      try {
        await app.listen(port);
        if (port !== startPort) {
          logger.warn(`Porta ${startPort} em uso; iniciando na porta ${port}`);
        }
        logger.log(`AirSync API ouvindo na porta ${port}`);
        return;
      } catch (err: any) {
        if (err && err.code === 'EADDRINUSE') {
          logger.warn(`Porta ${port} em uso; tentando ${port + 1}`);
          port += 1;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Nenhuma porta livre encontrada a partir de ${startPort}`);
  }

  await listenWithFallback(desired, 5);
}

bootstrap();
