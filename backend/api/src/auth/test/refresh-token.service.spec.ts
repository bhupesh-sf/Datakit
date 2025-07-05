import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { RefreshTokenService } from 'src/auth/refresh-token.service';
import { RefreshToken } from 'src/auth/entities/refresh-token.entity';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let refreshTokenRepository: Repository<RefreshToken>;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    name: 'Test User',
    avatarUrl: null,
    emailVerified: false,
    stripeCustomerId: null,
    currentWorkspaceId: null,
    currentWorkspace: null,
    ownedWorkspaces: [],
    workspaceMemberships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    subscription: null,
    creditUsages: [],
    refreshTokens: [],
  };

  const mockRefreshTokenEntity = {
    id: 'token-123',
    token: 'jwt-refresh-token',
    userId: 'user-123',
    user: mockUser,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    isRevoked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRefreshTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Clear mocks first
    jest.clearAllMocks();

    // Setup crypto spy
    jest
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

    // Setup config mock
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_REFRESH_SECRET':
          return 'test-refresh-secret';
        default:
          return undefined;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    refreshTokenRepository = module.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('generateRefreshToken', () => {
    const userId = 'user-123';
    const ipAddress = '192.168.1.1';
    const userAgent = 'Mozilla/5.0 Test Browser';

    it('should generate refresh token with all metadata', async () => {
      const mockJwtToken = 'generated-jwt-token';
      const mockTokenEntity = { id: 'token-123', token: mockJwtToken };

      // Mock current timestamp
      const mockTimestamp = 1640995200; // 2022-01-01 00:00:00
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp * 1000);
      jest.spyOn(Math, 'floor').mockReturnValue(mockTimestamp);

      mockJwtService.sign.mockReturnValue(mockJwtToken);
      mockRefreshTokenRepository.create.mockReturnValue(mockTokenEntity);
      mockRefreshTokenRepository.save.mockResolvedValue(mockTokenEntity);

      const result = await service.generateRefreshToken(
        userId,
        ipAddress,
        userAgent,
      );

      expect(result).toBe(mockJwtToken);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: userId,
          type: 'refresh',
          jti: '550e8400-e29b-41d4-a716-446655440000',
          iat: mockTimestamp,
        },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );

      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        token: mockJwtToken,
        userId,
        expiresAt: expect.any(Date),
        ipAddress,
        userAgent,
      });

      expect(mockRefreshTokenRepository.save).toHaveBeenCalledWith(
        mockTokenEntity,
      );

      // Cleanup mocks
      jest.restoreAllMocks();
    });

    it('should generate refresh token without optional metadata', async () => {
      const mockJwtToken = 'generated-jwt-token';
      const mockTokenEntity = { id: 'token-123', token: mockJwtToken };

      mockJwtService.sign.mockReturnValue(mockJwtToken);
      mockRefreshTokenRepository.create.mockReturnValue(mockTokenEntity);
      mockRefreshTokenRepository.save.mockResolvedValue(mockTokenEntity);

      const result = await service.generateRefreshToken(userId);

      expect(result).toBe(mockJwtToken);

      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        token: mockJwtToken,
        userId,
        expiresAt: expect.any(Date),
        ipAddress: undefined,
        userAgent: undefined,
      });
    });

    it('should set correct expiration date (7 days from now)', async () => {
      const mockJwtToken = 'generated-jwt-token';
      const mockTokenEntity = { id: 'token-123', token: mockJwtToken };

      const mockCurrentDate = new Date('2022-01-01T00:00:00Z');
      const expectedExpirationDate = new Date('2022-01-08T00:00:00Z');

      // Completely replace the global Date object
      const OriginalDate = global.Date;
      global.Date = function MockDate(...args: any[]) {
        if (args.length === 0) {
          return mockCurrentDate;
        }
        return new (OriginalDate as any)(...args);
      } as any;

      // Add static methods
      (global.Date as any).now = () => mockCurrentDate.getTime();
      (global.Date as any).parse = OriginalDate.parse;
      (global.Date as any).UTC = OriginalDate.UTC;

      mockJwtService.sign.mockReturnValue(mockJwtToken);
      mockRefreshTokenRepository.create.mockReturnValue(mockTokenEntity);
      mockRefreshTokenRepository.save.mockResolvedValue(mockTokenEntity);

      await service.generateRefreshToken(userId);

      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        token: mockJwtToken,
        userId,
        expiresAt: expectedExpirationDate,
        ipAddress: undefined,
        userAgent: undefined,
      });

      // Cleanup
      global.Date = OriginalDate;
      jest.restoreAllMocks();
    });

    it('should handle JWT service errors', async () => {
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(service.generateRefreshToken(userId)).rejects.toThrow(
        'JWT signing failed',
      );

      expect(mockRefreshTokenRepository.create).not.toHaveBeenCalled();
      expect(mockRefreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('should handle database save errors', async () => {
      const mockJwtToken = 'generated-jwt-token';
      const mockTokenEntity = { id: 'token-123', token: mockJwtToken };

      mockJwtService.sign.mockReturnValue(mockJwtToken);
      mockRefreshTokenRepository.create.mockReturnValue(mockTokenEntity);
      mockRefreshTokenRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.generateRefreshToken(userId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('validateRefreshToken', () => {
    const validToken = 'valid-jwt-token';

    it('should return token entity for valid non-expired token', async () => {
      const mockPayload = {
        sub: 'user-123',
        type: 'refresh',
        jti: 'unique-id',
        iat: 1640995200,
      };

      const mockTokenEntity = {
        ...mockRefreshTokenEntity,
        expiresAt: new Date(new Date().getTime() + 3600000), // 1 hour from now
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockTokenEntity);

      const result = await service.validateRefreshToken(validToken);

      expect(result).toEqual(mockTokenEntity);

      expect(mockJwtService.verify).toHaveBeenCalledWith(validToken, {
        secret: 'test-refresh-secret',
      });

      expect(mockRefreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          token: validToken,
          isRevoked: false,
        },
        relations: ['user'],
      });
    });

    it('should return null for token that is not in database', async () => {
      const mockPayload = {
        sub: 'user-123',
        type: 'refresh',
        jti: 'unique-id',
        iat: 1640995200,
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.validateRefreshToken(validToken);

      expect(result).toBeNull();
    });

    it('should return null for expired token in database', async () => {
      const mockPayload = {
        sub: 'user-123',
        type: 'refresh',
        jti: 'unique-id',
        iat: 1640995200,
      };

      const mockExpiredTokenEntity = {
        ...mockRefreshTokenEntity,
        expiresAt: new Date(new Date().getTime() - 3600000), // 1 hour ago
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRefreshTokenRepository.findOne.mockResolvedValue(
        mockExpiredTokenEntity,
      );

      const result = await service.validateRefreshToken(validToken);

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const mockPayload = {
        sub: 'user-123',
        type: 'refresh',
        jti: 'unique-id',
        iat: 1640995200,
      };

      const mockRevokedTokenEntity = {
        ...mockRefreshTokenEntity,
        isRevoked: true,
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.validateRefreshToken(validToken);

      expect(result).toBeNull();
    });

    it('should return null for invalid JWT signature', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await service.validateRefreshToken('invalid-token');

      expect(result).toBeNull();
      expect(mockRefreshTokenRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return null for expired JWT', async () => {
      mockJwtService.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = await service.validateRefreshToken('expired-token');

      expect(result).toBeNull();
    });

    it('should return null for malformed JWT', async () => {
      mockJwtService.verify.mockImplementation(() => {
        const error = new Error('Malformed token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const result = await service.validateRefreshToken('malformed-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke token by marking it as revoked', async () => {
      const tokenToRevoke = 'token-to-revoke';
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });

      await service.revokeToken(tokenToRevoke);

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { token: tokenToRevoke },
        { isRevoked: true },
      );
    });

    it('should handle non-existent token gracefully', async () => {
      const tokenToRevoke = 'non-existent-token';
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      await service.revokeToken(tokenToRevoke);

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { token: tokenToRevoke },
        { isRevoked: true },
      );
    });

    it('should handle database errors', async () => {
      const tokenToRevoke = 'token-to-revoke';
      mockRefreshTokenRepository.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.revokeToken(tokenToRevoke)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all active tokens for a user', async () => {
      const userId = 'user-123';
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 3 });

      await service.revokeAllUserTokens(userId);

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { userId, isRevoked: false },
        { isRevoked: true },
      );
    });

    it('should handle user with no active tokens', async () => {
      const userId = 'user-without-tokens';
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      await service.revokeAllUserTokens(userId);

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { userId, isRevoked: false },
        { isRevoked: true },
      );
    });

    it('should handle database errors', async () => {
      const userId = 'user-123';
      mockRefreshTokenRepository.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.revokeAllUserTokens(userId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('rotateRefreshToken', () => {
    const oldToken = 'old-refresh-token';
    const newToken = 'new-refresh-token';
    const ipAddress = '192.168.1.1';
    const userAgent = 'Mozilla/5.0 Test Browser';

    it('should successfully rotate valid refresh token', async () => {
      // Mock the validation to return a valid token entity
      const mockTokenEntity = {
        ...mockRefreshTokenEntity,
        userId: 'user-123',
      };

      jest
        .spyOn(service, 'validateRefreshToken')
        .mockResolvedValue(mockTokenEntity);
      jest.spyOn(service, 'revokeToken').mockResolvedValue(undefined);
      jest.spyOn(service, 'generateRefreshToken').mockResolvedValue(newToken);

      const result = await service.rotateRefreshToken(
        oldToken,
        ipAddress,
        userAgent,
      );

      expect(result).toBe(newToken);

      expect(service.validateRefreshToken).toHaveBeenCalledWith(oldToken);
      expect(service.revokeToken).toHaveBeenCalledWith(oldToken);
      expect(service.generateRefreshToken).toHaveBeenCalledWith(
        mockTokenEntity.userId,
        ipAddress,
        userAgent,
      );
    });

    it('should return null for invalid refresh token', async () => {
      jest.spyOn(service, 'validateRefreshToken').mockResolvedValue(null);
      jest.spyOn(service, 'revokeToken').mockResolvedValue(undefined);
      jest.spyOn(service, 'generateRefreshToken').mockResolvedValue(newToken);

      const result = await service.rotateRefreshToken(
        oldToken,
        ipAddress,
        userAgent,
      );

      expect(result).toBeNull();

      expect(service.validateRefreshToken).toHaveBeenCalledWith(oldToken);
      expect(service.revokeToken).not.toHaveBeenCalled();
      expect(service.generateRefreshToken).not.toHaveBeenCalled();
    });

    it('should work without IP address and user agent', async () => {
      const mockTokenEntity = {
        ...mockRefreshTokenEntity,
        userId: 'user-123',
      };

      jest
        .spyOn(service, 'validateRefreshToken')
        .mockResolvedValue(mockTokenEntity);
      jest.spyOn(service, 'revokeToken').mockResolvedValue(undefined);
      jest.spyOn(service, 'generateRefreshToken').mockResolvedValue(newToken);

      const result = await service.rotateRefreshToken(oldToken);

      expect(result).toBe(newToken);
      expect(service.generateRefreshToken).toHaveBeenCalledWith(
        mockTokenEntity.userId,
        undefined,
        undefined,
      );
    });

    it('should handle token revocation errors', async () => {
      const mockTokenEntity = {
        ...mockRefreshTokenEntity,
        userId: 'user-123',
      };

      jest
        .spyOn(service, 'validateRefreshToken')
        .mockResolvedValue(mockTokenEntity);
      jest
        .spyOn(service, 'revokeToken')
        .mockRejectedValue(new Error('Revocation failed'));

      await expect(service.rotateRefreshToken(oldToken)).rejects.toThrow(
        'Revocation failed',
      );

      expect(service.validateRefreshToken).toHaveBeenCalledWith(oldToken);
      expect(service.revokeToken).toHaveBeenCalledWith(oldToken);
    });

    it('should handle new token generation errors', async () => {
      const mockTokenEntity = {
        ...mockRefreshTokenEntity,
        userId: 'user-123',
      };

      jest
        .spyOn(service, 'validateRefreshToken')
        .mockResolvedValue(mockTokenEntity);
      jest.spyOn(service, 'revokeToken').mockResolvedValue(undefined);
      jest
        .spyOn(service, 'generateRefreshToken')
        .mockRejectedValue(new Error('Token generation failed'));

      await expect(service.rotateRefreshToken(oldToken)).rejects.toThrow(
        'Token generation failed',
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete all expired tokens', async () => {
      mockRefreshTokenRepository.delete.mockResolvedValue({ affected: 5 });

      await service.cleanupExpiredTokens();

      expect(mockRefreshTokenRepository.delete).toHaveBeenCalledWith({
        expiresAt: LessThan(expect.any(Date)),
      });
    });

    it('should handle case with no expired tokens', async () => {
      mockRefreshTokenRepository.delete.mockResolvedValue({ affected: 0 });

      await service.cleanupExpiredTokens();

      expect(mockRefreshTokenRepository.delete).toHaveBeenCalledWith({
        expiresAt: LessThan(expect.any(Date)),
      });
    });

    it('should handle database errors during cleanup', async () => {
      mockRefreshTokenRepository.delete.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.cleanupExpiredTokens()).rejects.toThrow(
        'Database error',
      );
    });

    it('should use current date for comparison', async () => {
      const mockCurrentDate = new Date('2022-01-01T12:00:00Z');
      const RealDate = Date;
      jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
        if (args.length === 0) {
          return mockCurrentDate;
        }
        return new (RealDate as any)(...args);
      }) as any);

      mockRefreshTokenRepository.delete.mockResolvedValue({ affected: 2 });

      await service.cleanupExpiredTokens();

      expect(mockRefreshTokenRepository.delete).toHaveBeenCalledWith({
        expiresAt: LessThan(mockCurrentDate),
      });

      // Cleanup
      jest.restoreAllMocks();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete token lifecycle', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Step 1: Generate initial token
      const initialToken = 'initial-token';
      mockJwtService.sign.mockReturnValue(initialToken);
      mockRefreshTokenRepository.create.mockReturnValue({
        id: 'token-1',
        token: initialToken,
      });
      mockRefreshTokenRepository.save.mockResolvedValue({
        id: 'token-1',
        token: initialToken,
      });

      const generatedToken = await service.generateRefreshToken(
        userId,
        ipAddress,
        userAgent,
      );
      expect(generatedToken).toBe(initialToken);

      // Step 2: Validate the token
      const mockTokenEntity = {
        ...mockRefreshTokenEntity,
        token: initialToken,
        userId,
      };
      mockJwtService.verify.mockReturnValue({ sub: userId, type: 'refresh' });
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockTokenEntity);

      const validatedToken = await service.validateRefreshToken(initialToken);
      expect(validatedToken).toEqual(mockTokenEntity);

      // Step 3: Rotate the token
      const rotatedToken = 'rotated-token';
      jest
        .spyOn(service, 'validateRefreshToken')
        .mockResolvedValue(mockTokenEntity);
      jest.spyOn(service, 'revokeToken').mockResolvedValue(undefined);
      jest
        .spyOn(service, 'generateRefreshToken')
        .mockResolvedValue(rotatedToken);

      const newToken = await service.rotateRefreshToken(
        initialToken,
        ipAddress,
        userAgent,
      );
      expect(newToken).toBe(rotatedToken);

      // Step 4: Revoke the old token (already called in rotation)
      expect(service.revokeToken).toHaveBeenCalledWith(initialToken);
    });

    it('should handle concurrent token operations safely', async () => {
      const userId = 'user-123';
      const tokens = ['token-1', 'token-2', 'token-3'];

      // Simulate concurrent token generation
      mockJwtService.sign.mockImplementation((payload) => `jwt-${payload.jti}`);
      mockRefreshTokenRepository.create.mockImplementation((data) => ({
        id: `id-${data.token}`,
        ...data,
      }));
      mockRefreshTokenRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const generationPromises = tokens.map((_, index) =>
        service.generateRefreshToken(userId, '192.168.1.1', 'Browser'),
      );

      const results = await Promise.all(generationPromises);

      expect(results).toHaveLength(3);
      expect(mockRefreshTokenRepository.save).toHaveBeenCalledTimes(3);
    });
  });
});
