import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.use(helmet());
    app.use(compression());
  }

  // Enable cookie parsing
  app.use(cookieParser());

  // Enable CORS for frontend
  // const allowedOrigins = process.env.ALLOWED_ORIGINS
  //   ? process.env.ALLOWED_ORIGINS.split(',')
  //   : [process.env.FRONTEND_URL || 'http://localhost:5173'];

  // TODO: Disabling the CORS for preview: https://feature-user-settings.datakit-v0.pages.dev/
  //
  // app.enableCors({
  //   origin: allowedOrigins,
  //   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  //   allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  //   exposedHeaders: ['Content-Type'],
  //   credentials: true, // Required for cookies
  // });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const protocol = isProduction ? 'https' : 'http';
  const host = isProduction ? 'production' : 'localhost';

  console.log(
    `🚀 DataKit API is running on: ${protocol}://${host}:${port}/api`,
  );
  console.log(
    `📊 Health check available at: ${protocol}://${host}:${port}/api/health`,
  );
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
