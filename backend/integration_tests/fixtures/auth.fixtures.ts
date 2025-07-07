import { RefreshToken } from '../../api/src/auth/entities/refresh-token.entity';
import * as jwt from 'jsonwebtoken';

export interface CreateRefreshTokenData {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthFixtures {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-integration-tests';
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-for-integration-tests';

  static createRefreshTokenData(overrides: Partial<CreateRefreshTokenData> = {}): CreateRefreshTokenData {
    const defaults: CreateRefreshTokenData = {
      userId: '',
      token: this.generateRandomToken(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent',
      createdAt: new Date(),
    };

    return { ...defaults, ...overrides };
  }

  static generateRandomToken(): string {
    return `refresh_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  // JWT Token generation
  static generateAccessToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '15m',
    });
  }

  static generateRefreshToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });
  }

  static generateAuthTokens(userId: string, email: string): AuthTokens {
    return {
      accessToken: this.generateAccessToken(userId, email),
      refreshToken: this.generateRefreshToken(userId, email),
    };
  }

  // Expired tokens
  static generateExpiredAccessToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
      iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '-1h', // Already expired
    });
  }

  static generateExpiredRefreshToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000) - 86400 * 8, // 8 days ago
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: '-1d', // Already expired
    });
  }

  // Invalid tokens
  static generateInvalidToken(): string {
    return 'invalid.jwt.token';
  }

  static generateMalformedToken(): string {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';
  }

  static generateTokenWithWrongSecret(userId: string, email: string): string {
    const payload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, 'wrong-secret', {
      expiresIn: '15m',
    });
  }

  // Predefined auth scenarios
  static readonly VALID_CREDENTIALS = {
    email: 'test@example.com',
    password: 'SecurePass2023!@',
  };

  static readonly INVALID_EMAIL_CREDENTIALS = {
    email: 'nonexistent@example.com',
    password: 'SecurePass2023!@',
  };

  static readonly INVALID_PASSWORD_CREDENTIALS = {
    email: 'test@example.com',
    password: 'WrongPassword123!',
  };

  static readonly EMPTY_CREDENTIALS = {
    email: '',
    password: '',
  };

  static readonly MALFORMED_EMAIL_CREDENTIALS = {
    email: 'not-an-email',
    password: 'SecurePass2023!@',
  };

  static readonly WEAK_PASSWORD_CREDENTIALS = {
    email: 'test@example.com',
    password: '123',
  };

  // Signup data
  static readonly VALID_SIGNUP_DATA = {
    email: 'newuser@example.com',
    password: 'NewPassword123!',
    name: 'New User',
  };

  static readonly DUPLICATE_EMAIL_SIGNUP = {
    email: 'test@example.com', // Assuming this already exists
    password: 'AnotherPassword123!',
    name: 'Another User',
  };

  static readonly INVALID_SIGNUP_DATA = {
    email: 'invalid-email',
    password: '123',
    name: '',
  };

  // Refresh token scenarios
  static createValidRefreshTokenData(userId: string): CreateRefreshTokenData {
    return this.createRefreshTokenData({
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });
  }

  static createExpiredRefreshTokenData(userId: string): CreateRefreshTokenData {
    return this.createRefreshTokenData({
      userId,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    });
  }

  static createRevokedRefreshTokenData(userId: string): CreateRefreshTokenData {
    return this.createRefreshTokenData({
      userId,
      // Assuming a revoked token would have a special marker or be deleted
    });
  }

  // Multiple tokens for user (for testing token rotation)
  static createMultipleRefreshTokens(userId: string, count: number): CreateRefreshTokenData[] {
    const tokens: CreateRefreshTokenData[] = [];
    
    for (let i = 0; i < count; i++) {
      tokens.push(this.createRefreshTokenData({
        userId,
        ipAddress: `192.168.1.${i + 1}`,
        userAgent: `Test User Agent ${i + 1}`,
      }));
    }
    
    return tokens;
  }

  // Security scenarios
  static createSuspiciousLoginAttempts(userId: string): CreateRefreshTokenData[] {
    return [
      this.createRefreshTokenData({
        userId,
        ipAddress: '192.168.1.100',
        userAgent: 'Suspicious Agent 1',
      }),
      this.createRefreshTokenData({
        userId,
        ipAddress: '10.0.0.50',
        userAgent: 'Suspicious Agent 2',
      }),
      this.createRefreshTokenData({
        userId,
        ipAddress: '172.16.0.25',
        userAgent: 'Suspicious Agent 3',
      }),
    ];
  }

  // Cookie scenarios
  static createCookieAuthScenario(accessToken: string, refreshToken: string): Record<string, string> {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  static createExpiredCookieAuthScenario(userId: string, email: string): Record<string, string> {
    return {
      access_token: this.generateExpiredAccessToken(userId, email),
      refresh_token: this.generateRefreshToken(userId, email), // Still valid refresh token
    };
  }

  static createInvalidCookieAuthScenario(): Record<string, string> {
    return {
      access_token: this.generateInvalidToken(),
      refresh_token: this.generateInvalidToken(),
    };
  }

  // Utility methods
  static decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  static verifyAccessToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JwtPayload;
    } catch {
      return null;
    }
  }

  static verifyRefreshToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      return null;
    }
  }
}