import { DataSource } from 'typeorm';
import { User } from '../../api/src/users/entities/user.entity';
import { Workspace } from '../../api/src/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../../api/src/workspaces/entities/workspace-member.entity';
import { Subscription } from '../../api/src/subscriptions/entities/subscription.entity';
import { CreditUsage } from '../../api/src/credits/entities/credit-usage.entity';
import { RefreshToken } from '../../api/src/auth/entities/refresh-token.entity';

export class DatabaseUtils {
  private static dataSource: DataSource;

  static async initializeDatabase(): Promise<DataSource> {
    if (this.dataSource?.isInitialized) {
      return this.dataSource;
    }

    // Simple database configuration for testing
    this.dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'datakit_e2e',
      entities: [User, Workspace, WorkspaceMember, Subscription, CreditUsage, RefreshToken],
      synchronize: true, // Auto-create schema for tests
      dropSchema: true,  // Fresh schema each run
      logging: false,
    });

    try {
      await this.dataSource.initialize();
      console.log('Test database initialized successfully');
      return this.dataSource;
    } catch (error) {
      console.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  static async cleanDatabase(): Promise<void> {
    if (!this.dataSource?.isInitialized) {
      return;
    }

    try {
      // Simple approach: truncate all tables (PostgreSQL syntax)
      const entities = this.dataSource.entityMetadatas;
      
      for (const entity of entities) {
        await this.dataSource.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`);
      }
      
    } catch (error) {
      console.error('Failed to clean database:', error);
      throw error;
    }
  }

  static async closeDatabase(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
      this.dataSource = null;
    }
  }
}