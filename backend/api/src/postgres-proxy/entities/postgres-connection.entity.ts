import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DatabaseConnectionUtil } from '../utils/database.util';

@Entity('postgres_connections')
@Index(['userId', 'name'], { unique: true }) // Unique connection names per user
export class PostgresConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // User-friendly name for the connection

  @Column()
  host: string;

  @Column()
  port: number;

  @Column()
  database: string;

  @Column()
  username: string;

  @Column({ type: 'text' })
  encryptedPassword: string; // Encrypted password

  @Column({ nullable: true })
  schema?: string; // Default schema to use

  @Column({ default: false })
  sslEnabled: boolean;

  @Column({ type: 'json', nullable: true })
  sslConfig?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  @Column({ default: 5432 })
  connectionTimeout: number; // in seconds

  @Column({ default: 30000 })
  queryTimeout: number; // in milliseconds

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastConnectionTest?: Date; // Last successful connection test

  @Column({ nullable: true })
  lastConnectionError?: string; // Last connection error message

  @Column({ type: 'json', nullable: true })
  metadata?: {
    version?: string; // PostgreSQL version
    serverName?: string;
    lastSchemaRefresh?: Date;
  };

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method to generate connection string (without exposing password)
  toConnectionString(decryptedPassword: string): string {
    return DatabaseConnectionUtil.buildConnectionString(this, decryptedPassword);
  }

  // Safe representation for API responses (excludes sensitive data)
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      host: this.host,
      port: this.port,
      database: this.database,
      username: this.username,
      schema: this.schema,
      sslEnabled: this.sslEnabled,
      connectionTimeout: this.connectionTimeout,
      queryTimeout: this.queryTimeout,
      isActive: this.isActive,
      lastConnectionTest: this.lastConnectionTest,
      lastConnectionError: this.lastConnectionError,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}