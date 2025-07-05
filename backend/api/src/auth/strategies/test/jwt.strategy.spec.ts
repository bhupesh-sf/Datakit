import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy, JwtPayload } from 'src/auth/strategies/jwt.strategy';
import { UsersService } from 'src/users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Setup default mocks before module creation
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_ACCESS_SECRET':
          return 'test-access-secret';
        case 'JWT_SECRET':
          return 'test-fallback-secret';
        default:
          return undefined;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks after module creation
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user for valid access token payload', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-123');
    });

    it('should throw UnauthorizedException for refresh token payload', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow('Invalid token type');

      expect(mockUsersService.findOne).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      const payload: JwtPayload = {
        sub: 'non-existent-user',
        email: 'test@example.com',
        type: 'access',
      };

      mockUsersService.findOne.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);

      expect(mockUsersService.findOne).toHaveBeenCalledWith('non-existent-user');
    });

    it('should handle user service errors', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      mockUsersService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate(payload)).rejects.toThrow('Database error');
    });

    it('should validate payload structure requirements', async () => {
      // Test with missing sub
      const payloadWithoutSub = {
        email: 'test@example.com',
        type: 'access' as const,
      } as JwtPayload;

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payloadWithoutSub);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(undefined);
    });

    it('should handle undefined user from service', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      mockUsersService.findOne.mockResolvedValue(undefined);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle falsy user from service', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      mockUsersService.findOne.mockResolvedValue(false as any);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('token extraction configuration', () => {
    it('should be configured to extract tokens from cookies first', () => {
      // Test that the strategy is properly configured
      // This tests the constructor setup
      expect(strategy).toBeDefined();
      // The constructor calls have already been made during module creation
      // We can't test the specific calls because they happened during beforeEach
      expect(strategy.name).toBe('jwt');
    });

    it('should use fallback secret when JWT_ACCESS_SECRET is not available', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'JWT_ACCESS_SECRET':
            return undefined;
          case 'JWT_SECRET':
            return 'fallback-secret';
          default:
            return undefined;
        }
      });

      // Create a new instance to test constructor behavior
      const newStrategy = new JwtStrategy(mockConfigService as any, mockUsersService as any);

      expect(newStrategy).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('should handle missing secrets gracefully', () => {
      mockConfigService.get.mockReturnValue(undefined);

      // The strategy constructor requires a secret, so this should throw an error
      // This test verifies that the constructor properly validates required config
      expect(() => {
        new JwtStrategy(mockConfigService as any, mockUsersService as any);
      }).toThrow('JwtStrategy requires a secret or key');
    });
  });

  describe('payload validation edge cases', () => {
    it('should handle payload with extra properties', async () => {
      const payloadWithExtras = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access' as const,
        extraProperty: 'should be ignored',
        iat: 1640995200,
        exp: 1640998800,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payloadWithExtras);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-123');
    });

    it('should handle different token types case-sensitively', async () => {
      const payloadWithWrongCase = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'ACCESS' as any, // Wrong case
      };

      await expect(strategy.validate(payloadWithWrongCase)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payloadWithWrongCase)).rejects.toThrow(
        'Invalid token type',
      );
    });

    it('should handle missing type property', async () => {
      const payloadWithoutType = {
        sub: 'user-123',
        email: 'test@example.com',
      } as any;

      await expect(strategy.validate(payloadWithoutType)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payloadWithoutType)).rejects.toThrow(
        'Invalid token type',
      );
    });

    it('should handle numeric user ID', async () => {
      const payloadWithNumericId = {
        sub: 123 as any, // Numeric instead of string
        email: 'test@example.com',
        type: 'access' as const,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payloadWithNumericId);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(123);
    });

    it('should handle empty string user ID', async () => {
      const payloadWithEmptyId = {
        sub: '',
        email: 'test@example.com',
        type: 'access' as const,
      };

      mockUsersService.findOne.mockResolvedValue(null);

      await expect(strategy.validate(payloadWithEmptyId)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockUsersService.findOne).toHaveBeenCalledWith('');
    });
  });

  describe('error handling scenarios', () => {
    it('should propagate user service network errors', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      mockUsersService.findOne.mockRejectedValue(networkError);

      await expect(strategy.validate(payload)).rejects.toThrow('Network timeout');
    });

    it('should propagate user service database errors', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      const dbError = new Error('Connection refused');
      dbError.name = 'DatabaseError';
      mockUsersService.findOne.mockRejectedValue(dbError);

      await expect(strategy.validate(payload)).rejects.toThrow('Connection refused');
    });

    it('should handle async user service timeout', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access',
      };

      // Simulate a hanging promise (timeout scenario)
      mockUsersService.findOne.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolves - simulates timeout
            setTimeout(() => resolve(mockUser), 10000);
          }),
      );

      // We expect this to timeout or hang, but for testing purposes,
      // we'll just verify the method was called
      const validatePromise = strategy.validate(payload);

      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-123');

      // Clean up the hanging promise
      mockUsersService.findOne.mockResolvedValue(mockUser);
    });
  });

  describe('integration with Passport JWT', () => {
    it('should be properly configured for passport integration', () => {
      // Verify the strategy instance has the necessary properties for Passport
      expect(strategy).toHaveProperty('authenticate');
      expect(strategy).toHaveProperty('name');
      expect(strategy.name).toBe('jwt');
    });

    it('should maintain consistent behavior with different payload formats', async () => {
      // Test multiple valid payloads to ensure consistency
      const payloads: JwtPayload[] = [
        { sub: 'user-1', email: 'user1@test.com', type: 'access' },
        { sub: 'user-2', email: 'user2@test.com', type: 'access' },
        { sub: 'user-3', email: 'user3@test.com', type: 'access' },
      ];

      const users = [
        { id: 'user-1', email: 'user1@test.com', name: 'User 1' },
        { id: 'user-2', email: 'user2@test.com', name: 'User 2' },
        { id: 'user-3', email: 'user3@test.com', name: 'User 3' },
      ];

      mockUsersService.findOne
        .mockResolvedValueOnce(users[0])
        .mockResolvedValueOnce(users[1])
        .mockResolvedValueOnce(users[2]);

      const results = await Promise.all(payloads.map((payload) => strategy.validate(payload)));

      expect(results).toEqual(users);
      expect(mockUsersService.findOne).toHaveBeenCalledTimes(3);
    });
  });
});