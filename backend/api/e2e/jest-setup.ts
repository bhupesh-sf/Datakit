import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';

// Polyfill for crypto in test environment
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
});

// Polyfill for TextEncoder/TextDecoder
Object.defineProperty(globalThis, 'TextEncoder', {
  value: TextEncoder,
});

Object.defineProperty(globalThis, 'TextDecoder', {
  value: TextDecoder,
});

// Set test environment variable
process.env.NODE_ENV = 'test';

// Set required environment variables for testing
process.env.JWT_SECRET = 'super-secret-jwt-key-change-this-in-production-please-make-it-long-and-random';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRATION = '7d';

// Use PostgreSQL test database
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_USERNAME = 'postgres';
process.env.DATABASE_PASSWORD = 'postgres';
process.env.DATABASE_NAME = 'datakit_test'; // Use separate test database
process.env.DATABASE_SYNCHRONIZE = 'true';
process.env.DATABASE_LOGGING = 'false';

// API Configuration
process.env.PORT = '3001';
process.env.FRONTEND_URL = 'http://localhost:5173';

// Add your actual Anthropic API key for testing
process.env.ANTHROPIC_API_KEY = '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';