import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { getTestDatabaseConfig } from './test-database.config';

// Import all modules
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { SubscriptionsModule } from '../src/subscriptions/subscriptions.module';
import { WorkspacesModule } from '../src/workspaces/workspaces.module';
import { CreditsModule } from '../src/credits/credits.module';
import { AIModule } from '../src/ai/ai.module';

export class TestAppFactory {
  static async createTestingModule(
    overrides: any = {},
  ): Promise<TestingModule> {
    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot(getTestDatabaseConfig()),
        AuthModule,
        UsersModule,
        SubscriptionsModule,
        WorkspacesModule,
        CreditsModule,
        AIModule,
      ],
    });

    // Apply any provider overrides for mocking
    Object.keys(overrides).forEach((token) => {
      moduleBuilder.overrideProvider(token).useValue(overrides[token]);
    });

    return moduleBuilder.compile();
  }

  static async createApp(module: TestingModule): Promise<INestApplication> {
    const app = module.createNestApplication();

    // Apply the same middleware as main app
    app.use(cookieParser());

    app.enableCors({
      origin: 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-ai-provider'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.setGlobalPrefix('api');

    await app.init();
    return app;
  }

  static async setupTestApp(overrides: any = {}): Promise<INestApplication> {
    const module = await this.createTestingModule(overrides);
    return this.createApp(module);
  }
}
