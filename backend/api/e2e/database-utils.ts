import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

// Import entities
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/subscriptions/entities/subscription.entity';
import { Workspace } from '../src/workspaces/entities/workspace.entity';
import { CreditUsage } from '../src/credits/entities/credit-usage.entity';

export class DatabaseUtils {
  private static dataSource: DataSource;

  static initialize(app: INestApplication) {
    this.dataSource = app.get(DataSource);
  }

  /**
   * Clean all tables in correct order (respects foreign keys)
   */
  static async cleanDatabase(): Promise<void> {
    if (!this.dataSource) {
      throw new Error(
        'DataSource not initialized. Call DatabaseUtils.initialize() first.',
      );
    }

    try {
      // Disable foreign key checks
      await this.dataSource.query('SET session_replication_role = replica;');

      // Manually delete in proper order to respect foreign keys
      const tablesToClean = [
        'refresh_tokens',
        'credit_usage',
        'workspace_members',
        'subscriptions',
        'workspaces',
        'users',
      ];

      for (const tableName of tablesToClean) {
        try {
          await this.dataSource.query(`DELETE FROM "${tableName}";`);
        } catch (error) {
          // Table might not exist yet, continue
          console.log(
            `Warning: Could not clean table ${tableName}:`,
            error.message,
          );
        }
      }

      // Re-enable foreign key checks
      await this.dataSource.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Database cleanup error:', error);
      // Reset foreign key checks in case of error
      await this.dataSource.query('SET session_replication_role = DEFAULT;');
      throw error;
    }
  }

  /**
   * Seed database with test data
   */
  static async seedTestData(app: INestApplication) {
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const subscriptionRepository = app.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    const workspaceRepository = app.get<Repository<Workspace>>(
      getRepositoryToken(Workspace),
    );

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const testUser = await userRepository.save({
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      emailVerified: true,
    });

    // Create workspace for user
    const workspace = await workspaceRepository.save({
      name: 'Test Workspace',
      ownerId: testUser.id,
      isPersonal: true,
    });

    // Update user with workspace
    await userRepository.update(testUser.id, {
      currentWorkspaceId: workspace.id,
    });

    // Create subscription
    const subscription = subscriptionRepository.create({
      userId: testUser.id,
      planType: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      creditsRemaining: 315,
      monthlyCredits: 315,
      creditsResetAt: new Date(),
    });
    await subscriptionRepository.save(subscription);

    return {
      user: { ...testUser, currentWorkspaceId: workspace.id },
      workspace,
    };
  }

  /**
   * Create a test user with authentication tokens
   */
  static async createAuthenticatedUser(
    app: INestApplication,
    userData: Partial<User> = {},
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
    const authService = app.get('AuthService');

    const defaultUserData = {
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Test User',
      emailVerified: true,
      ...userData,
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(defaultUserData.password, 10);

    // Create user
    const user = await userRepository.save({
      ...defaultUserData,
      password: hashedPassword,
    });

    // Generate tokens
    const loginResult = await authService.login(
      user,
      '127.0.0.1',
      'test-agent',
    );

    return {
      user,
      accessToken: loginResult.access_token,
      refreshToken: loginResult.refresh_token,
    };
  }

  /**
   * Execute SQL query for complex test setups
   */
  static async query(sql: string, parameters?: any[]): Promise<any> {
    return this.dataSource.query(sql, parameters);
  }

  /**
   * Get repository for entity
   */
  static getRepository<T>(
    app: INestApplication,
    entityClass: new () => T,
  ): Repository<T> {
    return app.get<Repository<T>>(getRepositoryToken(entityClass));
  }
}
