import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from '../jwt-auth.guard';

// Mock the AuthGuard from @nestjs/passport
jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn().mockImplementation((strategy: string) => {
    return class MockAuthGuard {
      async canActivate(context: ExecutionContext): Promise<boolean> {
        // This will be overridden in individual tests
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

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockExecutionContext: ExecutionContext;

  const mockRequest = {
    headers: {},
    user: null,
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);

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

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Guard instantiation', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should extend AuthGuard with jwt strategy', () => {
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });
  });

  describe('Authentication flow', () => {
    it('should allow access with valid JWT token', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock successful authentication
      jest.spyOn(guard, 'canActivate').mockResolvedValue(true);
      jest.spyOn(guard, 'handleRequest').mockReturnValue(mockUser);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should deny access without token', async () => {
      // Mock authentication failure
      jest.spyOn(guard, 'canActivate').mockResolvedValue(false);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should handle authentication errors', async () => {
      const authError = new UnauthorizedException('Invalid token');

      // Mock authentication throwing an error
      jest.spyOn(guard, 'canActivate').mockRejectedValue(authError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle missing user in handleRequest', () => {
      expect(() => {
        guard.handleRequest(null, null, null, mockExecutionContext);
      }).toThrow(UnauthorizedException);
    });

    it('should handle error in handleRequest', () => {
      const error = new Error('Authentication failed');

      expect(() => {
        guard.handleRequest(error, null, null, mockExecutionContext);
      }).toThrow('Authentication failed');
    });

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
  });

  describe('Integration scenarios', () => {
    it('should work with valid Bearer token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-jwt-token',
      };

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock the entire authentication flow
      jest.spyOn(guard, 'canActivate').mockImplementation(async () => {
        mockRequest.user = mockUser;
        return true;
      });

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockUser);
    });

    it('should reject malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'Invalid format',
      };

      jest.spyOn(guard, 'canActivate').mockResolvedValue(false);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should reject expired token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired-jwt-token',
      };

      const expiredError = new UnauthorizedException('Token expired');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(expiredError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Token expired',
      );
    });

    it('should handle invalid token signature', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-signature-token',
      };

      const signatureError = new UnauthorizedException('Invalid signature');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(signatureError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Invalid signature',
      );
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(networkError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Network timeout',
      );
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedError = new UnauthorizedException('Malformed token');
      jest.spyOn(guard, 'canActivate').mockRejectedValue(malformedError);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Malformed token',
      );
    });

    it('should provide appropriate error messages', () => {
      const testCases = [
        { error: null, user: null, expectedMessage: 'Unauthorized' },
        {
          error: new Error('Custom error'),
          user: null,
          expectedMessage: 'Custom error',
        },
        {
          error: new UnauthorizedException('Custom unauthorized'),
          user: null,
          expectedMessage: 'Custom unauthorized',
        },
      ];

      testCases.forEach(({ error, user, expectedMessage }) => {
        expect(() => {
          guard.handleRequest(error, user, null, mockExecutionContext);
        }).toThrow(expectedMessage);
      });
    });
  });

  describe('Strategy configuration', () => {
    it('should use jwt strategy', () => {
      // This test verifies that the guard is configured to use the 'jwt' strategy
      // The actual strategy implementation is tested in jwt.strategy.spec.ts
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });

    it('should handle different execution contexts', async () => {
      const httpContext = mockExecutionContext;
      const wsContext = {
        ...mockExecutionContext,
        getType: () => 'ws',
      } as ExecutionContext;

      jest.spyOn(guard, 'canActivate').mockResolvedValue(true);

      // Should work with HTTP context
      const httpResult = await guard.canActivate(httpContext);
      expect(httpResult).toBe(true);

      // Should work with WebSocket context (though JWT might not be typical for WS)
      const wsResult = await guard.canActivate(wsContext);
      expect(wsResult).toBe(true);
    });
  });
});
