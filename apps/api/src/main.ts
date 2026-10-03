import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('VeloraBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Edge & Security Headers (Section 85.20)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Cookie parser for signed session cookies (Section 85.10)
  app.use(cookieParser(process.env.COOKIE_SECRET || 'velora_cookie_signing_secret_99812_secure'));

  // 3. Strict CORS Policy (Section 85.18)
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin is not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Tenant-Id',
      'X-Branch-Id',
      'X-Request-Id',
      'X-Idempotency-Key',
    ],
  });

  // 4. API Versioning (Section 75 & 85.22)
  app.setGlobalPrefix('api/v1');

  // 5. Global Input Validation with strict DTO stripping (Section 85.14)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`====================================================`);
  logger.log(` VELORA API OPERATIONAL MONOLITH STARTED ON PORT ${port}`);
  logger.log(` Prefix: /api/v1`);
  logger.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`====================================================`);
}

bootstrap();
