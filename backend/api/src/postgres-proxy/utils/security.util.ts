import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

export interface EncryptionOptions {
  algorithm?: string;
  keyDerivation?: 'simple' | 'pbkdf2';
  iterations?: number;
  saltLength?: number;
}

export interface SQLSecurityOptions {
  allowedStatements?: string[];
  forbiddenPatterns?: RegExp[];
  maxQueryLength?: number;
}

export class SecurityUtil {
  private static readonly logger = new Logger(SecurityUtil.name);
  private static readonly DEFAULT_ALGORITHM = 'aes-256-cbc';
  private static readonly DEFAULT_ITERATIONS = 10000;
  private static readonly DEFAULT_SALT_LENGTH = 16;

  /**
   * Encrypts a password using AES-256-CBC with optional key derivation
   */
  static encryptPassword(
    password: string,
    encryptionKey: string,
    options: EncryptionOptions = {},
  ): string {
    const {
      algorithm = this.DEFAULT_ALGORITHM,
      keyDerivation = 'simple',
      iterations = this.DEFAULT_ITERATIONS,
      saltLength = this.DEFAULT_SALT_LENGTH,
    } = options;

    try {
      if (keyDerivation === 'pbkdf2') {
        // More secure PBKDF2 key derivation
        const salt = crypto.randomBytes(saltLength);
        const key = crypto.pbkdf2Sync(encryptionKey, salt, iterations, 32, 'sha256');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Combine salt + iv + encrypted data
        return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
      } else {
        // Simple encryption - use a fixed IV derived from key for backward compatibility
        const key = crypto.createHash('sha256').update(encryptionKey).digest();
        const iv = crypto.createHash('md5').update(encryptionKey).digest().slice(0, 16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
      }
    } catch (error) {
      this.logger.error(`Password encryption failed: ${error.message}`);
      throw new Error('Password encryption failed');
    }
  }

  /**
   * Decrypts a password
   */
  static decryptPassword(
    encryptedPassword: string,
    encryptionKey: string,
    options: EncryptionOptions = {},
  ): string {
    const {
      algorithm = this.DEFAULT_ALGORITHM,
      keyDerivation = 'simple',
      iterations = this.DEFAULT_ITERATIONS,
    } = options;

    try {
      if (keyDerivation === 'pbkdf2' && encryptedPassword.includes(':')) {
        // PBKDF2 decryption
        const [saltHex, ivHex, encrypted] = encryptedPassword.split(':');
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.pbkdf2Sync(encryptionKey, salt, iterations, 32, 'sha256');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } else {
        // Simple decryption - use same fixed IV derivation as encryption
        const key = crypto.createHash('sha256').update(encryptionKey).digest();
        const iv = crypto.createHash('md5').update(encryptionKey).digest().slice(0, 16);
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (error) {
      this.logger.error(`Password decryption failed: ${error.message}`);
      throw new Error('Password decryption failed');
    }
  }

  /**
   * Validates SQL query for security risks
   */
  static validateSQLSecurity(
    sql: string,
    options: SQLSecurityOptions = {},
  ): { isValid: boolean; errors: string[] } {
    const {
      maxQueryLength = 50000,
      forbiddenPatterns = [
        // Dangerous DDL operations
        /\b(drop\s+database|drop\s+schema)\b/i,
        /\b(truncate\s+table)\b/i,
        
        // Mass destructive operations
        /\b(delete\s+from.*where\s+1\s*=\s*1)\b/i,
        /\b(update.*set.*where\s+1\s*=\s*1)\b/i,
        
        // System function calls
        /\b(pg_read_file|pg_ls_dir|copy\s+.*to\s+program)\b/i,
        
        // SQL injection patterns
        /;\s*(drop|delete|truncate|insert|update|create|alter)\b/i,
        /union\s+select.*from\s+information_schema/i,
      ],
    } = options;

    const errors: string[] = [];

    // Check query length
    if (sql.length > maxQueryLength) {
      errors.push(`Query exceeds maximum length of ${maxQueryLength} characters`);
    }

    // Check for forbidden patterns
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sql)) {
        errors.push(`Query contains potentially dangerous operation: ${pattern.source}`);
      }
    }

    // Check for suspicious comment patterns
    if (/--.*union|\/\*.*union.*\*\//i.test(sql)) {
      errors.push('Query contains suspicious comment patterns');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitizes a string for safe usage in SQL queries
   */
  static sanitizeForSQL(value: string): string {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }
    
    // Escape single quotes and remove null bytes
    return value.replace(/'/g, "''").replace(/\0/g, '');
  }

  /**
   * Validates identifier names (table names, column names, etc.)
   */
  static validateSQLIdentifier(identifier: string): boolean {
    // PostgreSQL identifier rules: start with letter or underscore, 
    // contain only letters, digits, underscores, and dollar signs
    return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier) && identifier.length <= 63;
  }

  /**
   * Creates a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hashes a value using SHA-256
   */
  static hashSHA256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Creates a connection fingerprint for caching
   */
  static createConnectionFingerprint(
    host: string,
    port: number,
    database: string,
    username: string,
  ): string {
    const connectionString = `${host}:${port}:${database}:${username}`;
    return this.hashSHA256(connectionString);
  }

  /**
   * Redacts sensitive information from connection strings for logging
   */
  static redactConnectionString(connectionString: string): string {
    // Replace password in PostgreSQL connection string
    return connectionString.replace(
      /(postgresql:\/\/[^:]+:)[^@]+(@.*)/,
      '$1***REDACTED***$2',
    );
  }

  /**
   * Validates environment encryption key
   */
  static validateEncryptionKey(key: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!key || key.length === 0) {
      issues.push('Encryption key is required');
    } else {
      if (key.length < 32) {
        issues.push('Encryption key should be at least 32 characters long');
      }
      
      if (key === 'default-dev-key-change-in-production') {
        issues.push('Using default development encryption key in production');
      }
      
      if (!/[A-Z]/.test(key) || !/[a-z]/.test(key) || !/[0-9]/.test(key)) {
        issues.push('Encryption key should contain uppercase, lowercase, and numeric characters');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}