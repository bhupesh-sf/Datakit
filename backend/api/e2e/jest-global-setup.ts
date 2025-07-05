import { Client } from 'pg';

export default async function globalSetup() {
  console.log('🔧 Setting up test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_NAME = 'datakit_test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  // Create test database if it doesn't exist
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: 'postgres', // Connect to default database
  });

  try {
    await client.connect();
    
    // Check if test database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'datakit_test'"
    );
    
    if (result.rows.length === 0) {
      await client.query('CREATE DATABASE datakit_test');
      console.log('✅ Test database created');
    } else {
      console.log('✅ Test database already exists');
    }
  } catch (error) {
    console.log('⚠️ Database setup warning:', error.message);
  } finally {
    await client.end();
  }

  console.log('🚀 Test environment ready');
}