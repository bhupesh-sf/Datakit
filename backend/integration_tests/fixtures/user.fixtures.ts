import { User } from '../../api/src/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
  isEmailVerified?: boolean;
}

export class UserFixtures {
  static async createUserData(overrides: Partial<CreateUserData> = {}): Promise<CreateUserData> {
    const defaults: CreateUserData = {
      email: `test${Date.now()}@example.com`,
      password: 'SecurePass2023!@',
      name: 'Test User',
      isEmailVerified: true,
    };

    return { ...defaults, ...overrides };
  }

  static async createHashedPassword(plainPassword: string = 'SecurePass2023!@'): Promise<string> {
    return bcrypt.hash(plainPassword, 10);
  }

  // Predefined user fixtures for common test scenarios
  static readonly VALID_USER = {
    email: 'valid.user@example.com',
    password: 'ValidPassword123!',
    name: 'Valid User',
  };

  static readonly ADMIN_USER = {
    email: 'admin@example.com',
    password: 'AdminPassword123!',
    name: 'Admin User',
  };

  static readonly UNVERIFIED_USER = {
    email: 'unverified@example.com',
    password: 'UnverifiedPassword123!',
    name: 'Unverified User',
    isEmailVerified: false,
  };

  static readonly PREMIUM_USER = {
    email: 'premium@example.com',
    password: 'PremiumPassword123!',
    name: 'Premium User',
  };

  // Test data for validation scenarios
  static readonly INVALID_EMAIL_USER = {
    email: 'invalid-email',
    password: 'ValidPassword123!',
    name: 'Invalid Email User',
  };

  static readonly WEAK_PASSWORD_USER = {
    email: 'weakpass@example.com',
    password: '123',
    name: 'Weak Password User',
  };

  static readonly LONG_NAME_USER = {
    email: 'longname@example.com',
    password: 'ValidPassword123!',
    name: 'A'.repeat(256), // Assuming max length is 255
  };

  // Batch creation helpers
  static async createMultipleUsers(count: number): Promise<CreateUserData[]> {
    const users: CreateUserData[] = [];
    
    for (let i = 0; i < count; i++) {
      users.push(await this.createUserData({
        email: `user${i}@example.com`,
        name: `Test User ${i}`,
      }));
    }

    return users;
  }

  static async createUsersWithWorkspaces(count: number): Promise<CreateUserData[]> {
    return this.createMultipleUsers(count);
  }
}