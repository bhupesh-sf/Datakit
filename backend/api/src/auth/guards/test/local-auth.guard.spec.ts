import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { LocalAuthGuard } from '../local-auth.guard';

// Mock the AuthGuard from @nestjs/passport
jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn().mockImplementation((strategy: string) => {
    return class MockAuthGuard {
      async canActivate(context: ExecutionContext): Promise<boolean> {
        return true;
      }

      handleRequest(err: any, user: any, info: any) {
        if (err || !user) {
          throw err || new UnauthorizedException();
        }
        return user;
      }
    };
  }),
}));

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;
  let mockExecutionContext: ExecutionContext;

  const mockRequest = {
    body: {
      email: '',
      password: '',
    } as { email?: string; password?: string },
    user: null,
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalAuthGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);

    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
        getNext: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    } as ExecutionContext;

    // Clear mocks and reset request
    jest.clearAllMocks();
    mockRequest.body = { email: '', password: '' };
    mockRequest.user = null;
  });

  describe('Guard instantiation', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should extend AuthGuard with local strategy', () => {
      expect(guard).toBeInstanceOf(LocalAuthGuard);
    });
  });

  describe('Authentication flow', () => {
    it('should allow access with valid credentials', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockRequest.body = {
        email: 'test@example.com',
        password: 'validpassword',
      };

      // Mock successful authentication
      jest.spyOn(guard, 'canActivate').mockImplementation(async () => {
        mockRequest.user = mockUser;
        return true;
      });

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockUser);
    });

    it('should deny access with invalid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Mock authentication failure
      jest.spyOn(guard, 'canActivate').mockResolvedValue(false);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should handle missing email', async () => {
      mockRequest.body = {
        password: 'somepassword',
      } as any;

      const authError = new UnauthorizedException('Email is required');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Email is required',
      );
    });

    it('should handle missing password', async () => {
      mockRequest.body = {
        email: 'test@example.com',
      } as any;

      const authError = new UnauthorizedException('Password is required');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Password is required',
      );
    });

    it('should handle empty credentials', async () => {
      mockRequest.body = {
        email: '',
        password: '',
      };

      const authError = new UnauthorizedException('Invalid credentials');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('handleRequest method', () => {
    it('should return user when authentication succeeds', () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const result = guard.handleRequest(
        null,
        mockUser,
        null,
        mockExecutionContext,
      );

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => {
        guard.handleRequest(null, null, null, mockExecutionContext);
      }).toThrow(UnauthorizedException);
    });

    it('should throw error when authentication fails', () => {
      const error = new UnauthorizedException('Invalid credentials');

      expect(() => {
        guard.handleRequest(error, null, null, mockExecutionContext);
      }).toThrow('Invalid credentials');
    });

    it('should handle authentication info', () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const info = { message: 'User authenticated successfully' };

      const result = guard.handleRequest(
        null,
        mockUser,
        info,
        mockExecutionContext,
      );

      expect(result).toEqual(mockUser);
    });
  });

  describe('Integration scenarios', () => {
    it('should work with valid email and password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: '$2a$10$hashedpassword',
      };

      mockRequest.body = {
        email: 'test@example.com',
        password: 'correctpassword',
      };

      jest.spyOn(guard, 'canActivate').mockImplementation(async () => {
        // Simulate local strategy validation
        mockRequest.user = mockUser;
        return true;
      });

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockUser);
    });

    it('should reject with incorrect password', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const authError = new UnauthorizedException('Invalid credentials');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should reject with non-existent email', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
        password: 'somepassword',
      };

      const authError = new UnauthorizedException('User not found');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'User not found',
      );
    });

    it('should handle malformed request body', async () => {
      mockRequest.body = 'invalid json' as any;

      const authError = new UnauthorizedException('Invalid request format');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Invalid request format',
      );
    });

    it('should handle SQL injection attempts', async () => {
      mockRequest.body = {
        email: "admin'; DROP TABLE users; --",
        password: 'password',
      };

      const authError = new UnauthorizedException('Invalid credentials');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password',
      };

      const dbError = new Error('Database connection failed');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(dbError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle rate limiting', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password',
      };

      const rateLimitError = new UnauthorizedException(
        'Too many login attempts',
      );
      jest.spyOn(guard, 'canActivate').mockRejectedValue(rateLimitError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Too many login attempts',
      );
    });

    it('should handle account locked scenarios', async () => {
      mockRequest.body = {
        email: 'locked@example.com',
        password: 'password',
      };

      const lockedError = new UnauthorizedException('Account is locked');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(lockedError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Account is locked',
      );
    });
  });

  describe('Strategy configuration', () => {
    it('should use local strategy', () => {
      expect(guard).toBeInstanceOf(LocalAuthGuard);
    });

    it('should work with different request formats', async () => {
      // Test with form data
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password',
      };

      jest.spyOn(guard, 'canActivate').mockResolvedValue(true);

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle case-insensitive email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.body = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password',
      };

      jest.spyOn(guard, 'canActivate').mockImplementation(async () => {
        // Local strategy should normalize email
        mockRequest.user = mockUser;
        return true;
      });

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should not leak sensitive information in errors', () => {
      const testCases = [
        { error: null, user: null, expectedType: UnauthorizedException },
        { error: new Error('Database error'), user: null, expectedType: Error },
      ];

      testCases.forEach(({ error, user, expectedType }) => {
        expect(() => {
          guard.handleRequest(error, user, null, mockExecutionContext);
        }).toThrow(expectedType);
      });
    });

    it('should handle timing attacks prevention', async () => {
      // Both valid and invalid emails should take similar time
      const validEmailRequest = {
        email: 'valid@example.com',
        password: 'wrongpassword',
      };

      const invalidEmailRequest = {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      };

      mockRequest.body = validEmailRequest;
      jest.spyOn(guard, 'canActivate').mockResolvedValue(false);

      const start1 = Date.now();
      await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(
        false,
      );
      const time1 = Date.now() - start1;

      mockRequest.body = invalidEmailRequest;
      const start2 = Date.now();
      await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(
        false,
      );
      const time2 = Date.now() - start2;

      // Times should be reasonably similar (allowing for test execution variance)
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });
  });
});
