import { DatabaseUtils } from './database-utils';

async function setupDatabase() {
  try {
    await DatabaseUtils.initializeDatabase();
    console.log('Database setup completed');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();