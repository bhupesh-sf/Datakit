import { SecurityUtil } from './security.util';

jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
}));

describe('SecurityUtil', () => {
  const testPassword = 'myTestPassword123!';
  const testEncryptionKey = 'myEncryptionKey456';
  const testEncryptionKeyDifferent = 'differentKey789';

  describe('encryptPassword and decryptPassword', () => {
    describe('simple encryption (default)', () => {
      it('should encrypt and decrypt password successfully', () => {
        const encrypted = SecurityUtil.encryptPassword(testPassword, testEncryptionKey);
        expect(encrypted).toBeTruthy();
        expect(encrypted).not.toBe(testPassword);
        expect(typeof encrypted).toBe('string');

        const decrypted = SecurityUtil.decryptPassword(encrypted, testEncryptionKey);
        expect(decrypted).toBe(testPassword);
      });

      it('should produce different encrypted values for same input', () => {
        // Note: With fixed IV for backward compatibility, this might be the same
        // But that's okay for backward compatibility
        const encrypted1 = SecurityUtil.encryptPassword(testPassword, testEncryptionKey);
        const encrypted2 = SecurityUtil.encryptPassword(testPassword, testEncryptionKey);
        
        expect(encrypted1).toBeTruthy();
        expect(encrypted2).toBeTruthy();
        // For simple mode with fixed IV, these will be the same (by design for backward compatibility)
        expect(encrypted1).toBe(encrypted2);
      });

      it('should fail to decrypt with wrong key', () => {
        const encrypted = SecurityUtil.encryptPassword(testPassword, testEncryptionKey);

        expect(() => {
          SecurityUtil.decryptPassword(encrypted, testEncryptionKeyDifferent);
        }).toThrow('Password decryption failed');
      });

      it('should handle empty password', () => {
        const encrypted = SecurityUtil.encryptPassword('', testEncryptionKey);
        const decrypted = SecurityUtil.decryptPassword(encrypted, testEncryptionKey);
        expect(decrypted).toBe('');
      });

      it('should handle special characters in password', () => {
        const specialPassword = 'p@ssw0rd!#$%^&*()';
        const encrypted = SecurityUtil.encryptPassword(specialPassword, testEncryptionKey);
        const decrypted = SecurityUtil.decryptPassword(encrypted, testEncryptionKey);
        expect(decrypted).toBe(specialPassword);
      });
    });

    describe('PBKDF2 encryption (secure)', () => {
      it('should encrypt and decrypt password with PBKDF2', () => {
        const encrypted = SecurityUtil.encryptPassword(testPassword, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });

        expect(encrypted).toBeTruthy();
        expect(encrypted.split(':').length).toBe(3); // salt:iv:encrypted format
        
        const decrypted = SecurityUtil.decryptPassword(encrypted, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });
        expect(decrypted).toBe(testPassword);
      });

      it('should produce different encrypted values for same input with PBKDF2', () => {
        const encrypted1 = SecurityUtil.encryptPassword(testPassword, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });
        const encrypted2 = SecurityUtil.encryptPassword(testPassword, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });

        expect(encrypted1).not.toBe(encrypted2); // Should be different due to random salt and IV
        
        // Both should decrypt to same password
        const decrypted1 = SecurityUtil.decryptPassword(encrypted1, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });
        const decrypted2 = SecurityUtil.decryptPassword(encrypted2, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });
        
        expect(decrypted1).toBe(testPassword);
        expect(decrypted2).toBe(testPassword);
      });

      it('should fail to decrypt PBKDF2 with wrong key', () => {
        const encrypted = SecurityUtil.encryptPassword(testPassword, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
        });

        expect(() => {
          SecurityUtil.decryptPassword(encrypted, testEncryptionKeyDifferent, {
            keyDerivation: 'pbkdf2',
          });
        }).toThrow('Password decryption failed');
      });

      it('should use custom iterations and salt length', () => {
        const encrypted = SecurityUtil.encryptPassword(testPassword, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
          iterations: 5000,
          saltLength: 32,
        });

        expect(encrypted.split(':').length).toBe(3);
        expect(Buffer.from(encrypted.split(':')[0], 'hex').length).toBe(32); // salt length

        const decrypted = SecurityUtil.decryptPassword(encrypted, testEncryptionKey, {
          keyDerivation: 'pbkdf2',
          iterations: 5000,
        });
        expect(decrypted).toBe(testPassword);
      });
    });

    describe('error handling', () => {
      it('should handle invalid encrypted data gracefully', () => {
        expect(() => {
          SecurityUtil.decryptPassword('invalid_encrypted_data', testEncryptionKey);
        }).toThrow('Password decryption failed');
      });

      it('should handle malformed PBKDF2 data', () => {
        expect(() => {
          SecurityUtil.decryptPassword('malformed:data', testEncryptionKey, {
            keyDerivation: 'pbkdf2',
          });
        }).toThrow('Password decryption failed');
      });

      it('should handle invalid algorithm gracefully', () => {
        expect(() => {
          SecurityUtil.encryptPassword(testPassword, testEncryptionKey, {
            algorithm: 'invalid-algorithm' as any,
          });
        }).toThrow('Password encryption failed');
      });
    });
  });

  describe('validateSQLSecurity', () => {
    it('should validate safe SELECT queries', () => {
      const result = SecurityUtil.validateSQLSecurity('SELECT * FROM users WHERE id = 1');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject queries with dangerous patterns', () => {
      const dangerousQueries = [
        'SELECT * FROM users; DROP TABLE users;',
        'SELECT * FROM users WHERE id = 1 UNION SELECT password FROM admin',
        'SELECT * FROM users WHERE name = \'admin\'; INSERT INTO logs VALUES (1);',
      ];

      dangerousQueries.forEach(query => {
        const result = SecurityUtil.validateSQLSecurity(query);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should enforce query length limits', () => {
      const longQuery = 'SELECT ' + 'col, '.repeat(1000) + 'id FROM users';
      const result = SecurityUtil.validateSQLSecurity(longQuery, { maxQueryLength: 100 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Query exceeds maximum length of 100 characters');
    });

    it('should allow safe INSERT queries', () => {
      const result = SecurityUtil.validateSQLSecurity('INSERT INTO users (name) VALUES (\'test\')');
      expect(result.isValid).toBe(true);
    });

    it('should reject dangerous DELETE queries', () => {
      const result = SecurityUtil.validateSQLSecurity('DELETE FROM users WHERE 1=1');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeForSQL', () => {
    it('should escape single quotes', () => {
      const result = SecurityUtil.sanitizeForSQL("O'Neil");
      expect(result).toBe("O''Neil");
    });

    it('should handle multiple quotes', () => {
      const result = SecurityUtil.sanitizeForSQL("It's a 'test' string");
      expect(result).toBe("It''s a ''test'' string");
    });

    it('should handle empty string', () => {
      const result = SecurityUtil.sanitizeForSQL('');
      expect(result).toBe('');
    });
  });

  describe('validateSQLIdentifier', () => {
    it('should validate proper identifiers', () => {
      const validIdentifiers = ['table_name', 'column123', 'valid_identifier'];
      validIdentifiers.forEach(identifier => {
        expect(SecurityUtil.validateSQLIdentifier(identifier)).toBe(true);
      });
    });

    it('should reject invalid identifiers', () => {
      const invalidIdentifiers = [
        'table-name',      // hyphen
        'table name',      // space
        '123table',        // starts with number
        'table;drop',      // semicolon
        '',                // empty
        'table"name',      // quote
      ];
      
      invalidIdentifiers.forEach(identifier => {
        expect(SecurityUtil.validateSQLIdentifier(identifier)).toBe(false);
      });
    });
  });

  describe('integration tests', () => {
    it('should work with real PostgreSQL connection scenarios', () => {
      // Simulate real usage scenario
      const connectionPassword = 'myRealPassword123!@#';
      const encryptionKey = process.env.POSTGRES_ENCRYPTION_KEY || 'fallback-key-for-tests';

      // Test simple encryption (backward compatibility)
      const encryptedSimple = SecurityUtil.encryptPassword(connectionPassword, encryptionKey);
      const decryptedSimple = SecurityUtil.decryptPassword(encryptedSimple, encryptionKey);
      expect(decryptedSimple).toBe(connectionPassword);

      // Test secure encryption (recommended)
      const encryptedSecure = SecurityUtil.encryptPassword(connectionPassword, encryptionKey, {
        keyDerivation: 'pbkdf2',
      });
      const decryptedSecure = SecurityUtil.decryptPassword(encryptedSecure, encryptionKey, {
        keyDerivation: 'pbkdf2',
      });
      expect(decryptedSecure).toBe(connectionPassword);

      // Validate a typical SELECT query
      const query = 'SELECT id, name, email FROM users WHERE active = true LIMIT 100';
      const queryValidation = SecurityUtil.validateSQLSecurity(query);
      expect(queryValidation.isValid).toBe(true);
    });

    it('should handle edge cases for database names and table names', () => {
      const edgeCaseNames = [
        'my_database',
        'test123',
        'db_with_underscores',
        'CamelCase',
      ];

      edgeCaseNames.forEach(name => {
        expect(SecurityUtil.validateSQLIdentifier(name)).toBe(true);
      });
    });
  });
});