import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getTestDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'datakit_test',
  entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  synchronize: true, // Only for testing
  dropSchema: true, // Drop schema before each test suite
  logging: false,
  // Use separate connection pools for testing
  extra: {
    max: 5, // Limit connections for testing
    connectionTimeoutMillis: 2000,
  },
});