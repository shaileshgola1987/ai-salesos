import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { validateEnv } from './common/validate-env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestLoggerMiddleware } from './common/middleware/request-logger.middleware';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(compression());
  app.use(requestLoggerMiddleware);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
    credentials: true,
  });
  // Lets Nest run onModuleDestroy (Prisma's $disconnect) on SIGTERM/SIGINT instead of the
  // process being killed mid-request during a deploy or container restart.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}
void bootstrap();
