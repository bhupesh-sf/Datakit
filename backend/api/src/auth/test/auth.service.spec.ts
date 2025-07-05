import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';

import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import { RefreshTokenService } from 'src/auth/refresh-token.service';
import * as bcrypt from 'bcryptjs';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let subscriptionsService: SubscriptionsService;
  let workspacesService: WorkspacesService;
  let refreshTokenService: RefreshTokenService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockSubscriptionsService = {
    createFreeSubscription: jest.fn(),
  };

  const mockWorkspacesService = {
    createPersonalWorkspace: jest.fn(),
  };

  const mockRefreshTokenService = {
    generateRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    validateRefreshToken: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: WorkspacesService,
          useValue: mockWorkspacesService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    subscriptionsService =
      module.get<SubscriptionsService>(SubscriptionsService);
    workspacesService = module.get<WorkspacesService>(WorkspacesService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);

    // Setup default mocks
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_ACCESS_SECRET':
          return 'test-access-secret';
        case 'JWT_SECRET':
          return 'test-secret';
        case 'JWT_REFRESH_SECRET':
          return 'test-refresh-secret';
        default:
          return undefined;
      }
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password',
        mockUser.password,
      );
    });

    it('should return null when user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is incorrect', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });

    it('should handle bcrypt errors by propagating them', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockImplementation(() => {
        throw new Error('Bcrypt error');
      });

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Bcrypt error');
    });
  });

  describe('login', () => {
    const mockUserForLogin = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    it('should generate access and refresh tokens for valid user', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      mockJwtService.sign.mockReturnValue(mockAccessToken);
      mockRefreshTokenService.generateRefreshToken.mockResolvedValue(
        mockRefreshToken,
      );

      const result = await service.login(
        mockUserForLogin,
        ipAddress,
        userAgent,
      );

      expect(result).toEqual({
        user: mockUserForLogin,
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          email: mockUserForLogin.email,
          sub: mockUserForLogin.id,
          type: 'access',
        },
        {
          secret: 'test-access-secret',
          expiresIn: '15m',
        },
      );

      expect(mockRefreshTokenService.generateRefreshToken).toHaveBeenCalledWith(
        mockUserForLogin.id,
        ipAddress,
        userAgent,
      );
    });

    it('should use fallback JWT secret if access secret is not configured', async () => {
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

      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockJwtService.sign.mockReturnValue(mockAccessToken);
      mockRefreshTokenService.generateRefreshToken.mockResolvedValue(
        mockRefreshToken,
      );

      await service.login(mockUserForLogin);

      expect(mockJwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
        secret: 'fallback-secret',
        expiresIn: '15m',
      });
    });

    it('should work without IP address and user agent', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockJwtService.sign.mockReturnValue(mockAccessToken);
      mockRefreshTokenService.generateRefreshToken.mockResolvedValue(
        mockRefreshToken,
      );

      const result = await service.login(mockUserForLogin);

      expect(result.access_token).toBe(mockAccessToken);
      expect(result.refresh_token).toBe(mockRefreshToken);
      expect(mockRefreshTokenService.generateRefreshToken).toHaveBeenCalledWith(
        mockUserForLogin.id,
        undefined,
        undefined,
      );
    });
  });

  describe('signup', () => {
    const signupDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    const mockCreatedUser = {
      id: 'new-user-123',
      email: signupDto.email,
      name: signupDto.name,
    };

    const mockUserWithSubscription = {
      ...mockCreatedUser,
      subscription: { id: 'sub-123', planType: 'FREE' },
    };

    it('should create user, subscription, workspace and return login tokens', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      mockUsersService.create.mockResolvedValue(mockCreatedUser);
      mockSubscriptionsService.createFreeSubscription.mockResolvedValue({});
      mockWorkspacesService.createPersonalWorkspace.mockResolvedValue({});
      mockUsersService.findOne.mockResolvedValue(mockUserWithSubscription);
      mockJwtService.sign.mockReturnValue(mockAccessToken);
      mockRefreshTokenService.generateRefreshToken.mockResolvedValue(
        mockRefreshToken,
      );

      const result = await service.signup(signupDto, ipAddress, userAgent);

      expect(result).toEqual({
        user: mockUserWithSubscription,
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
      });

      expect(mockUsersService.create).toHaveBeenCalledWith(
        signupDto.email,
        signupDto.password,
        signupDto.name,
      );
      expect(
        mockSubscriptionsService.createFreeSubscription,
      ).toHaveBeenCalledWith(mockCreatedUser.id);
      expect(
        mockWorkspacesService.createPersonalWorkspace,
      ).toHaveBeenCalledWith(mockCreatedUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(mockCreatedUser.id);
    });

    it('should handle signup without name', async () => {
      const signupDtoWithoutName = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      mockUsersService.create.mockResolvedValue(mockCreatedUser);
      mockSubscriptionsService.createFreeSubscription.mockResolvedValue({});
      mockWorkspacesService.createPersonalWorkspace.mockResolvedValue({});
      mockUsersService.findOne.mockResolvedValue(mockUserWithSubscription);
      mockJwtService.sign.mockReturnValue('token');
      mockRefreshTokenService.generateRefreshToken.mockResolvedValue('refresh');

      await service.signup(signupDtoWithoutName as any);

      expect(mockUsersService.create).toHaveBeenCalledWith(
        signupDtoWithoutName.email,
        signupDtoWithoutName.password,
        undefined,
      );
    });

    it('should propagate user creation errors', async () => {
      mockUsersService.create.mockRejectedValue(
        new Error('Email already exists'),
      );

      await expect(service.signup(signupDto)).rejects.toThrow(
        'Email already exists',
      );

      expect(
        mockSubscriptionsService.createFreeSubscription,
      ).not.toHaveBeenCalled();
      expect(
        mockWorkspacesService.createPersonalWorkspace,
      ).not.toHaveBeenCalled();
    });

    it('should handle subscription creation failure', async () => {
      mockUsersService.create.mockResolvedValue(mockCreatedUser);
      mockSubscriptionsService.createFreeSubscription.mockRejectedValue(
        new Error('Subscription creation failed'),
      );

      await expect(service.signup(signupDto)).rejects.toThrow(
        'Subscription creation failed',
      );

      expect(
        mockWorkspacesService.createPersonalWorkspace,
      ).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshToken = 'valid-refresh-token';
    const mockNewRefreshToken = 'new-refresh-token';
    const mockTokenEntity = {
      id: 'token-123',
      userId: 'user-123',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    it('should successfully refresh access token with valid refresh token', async () => {
      const mockNewAccessToken = 'new-access-token';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      mockRefreshTokenService.rotateRefreshToken.mockResolvedValue(
        mockNewRefreshToken,
      );
      mockRefreshTokenService.validateRefreshToken.mockResolvedValue(
        mockTokenEntity,
      );
      mockJwtService.sign.mockReturnValue(mockNewAccessToken);

      const result = await service.refreshAccessToken(
        mockRefreshToken,
        ipAddress,
        userAgent,
      );

      expect(result).toEqual({
        access_token: mockNewAccessToken,
        refresh_token: mockNewRefreshToken,
      });

      expect(mockRefreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        mockRefreshToken,
        ipAddress,
        userAgent,
      );
      expect(mockRefreshTokenService.validateRefreshToken).toHaveBeenCalledWith(
        mockNewRefreshToken,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          email: mockTokenEntity.user.email,
          sub: mockTokenEntity.user.id,
          type: 'access',
        },
        {
          secret: 'test-access-secret',
          expiresIn: '15m',
        },
      );
    });

    it('should throw UnauthorizedException when refresh token rotation fails', async () => {
      mockRefreshTokenService.rotateRefreshToken.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken(mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshAccessToken(mockRefreshToken),
      ).rejects.toThrow('Invalid refresh token');

      expect(
        mockRefreshTokenService.validateRefreshToken,
      ).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when new refresh token validation fails', async () => {
      mockRefreshTokenService.rotateRefreshToken.mockResolvedValue(
        mockNewRefreshToken,
      );
      mockRefreshTokenService.validateRefreshToken.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken(mockRefreshToken),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshAccessToken(mockRefreshToken),
      ).rejects.toThrow('Invalid refresh token');

      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should work without IP address and user agent', async () => {
      const mockNewAccessToken = 'new-access-token';

      mockRefreshTokenService.rotateRefreshToken.mockResolvedValue(
        mockNewRefreshToken,
      );
      mockRefreshTokenService.validateRefreshToken.mockResolvedValue(
        mockTokenEntity,
      );
      mockJwtService.sign.mockReturnValue(mockNewAccessToken);

      const result = await service.refreshAccessToken(mockRefreshToken);

      expect(result.access_token).toBe(mockNewAccessToken);
      expect(result.refresh_token).toBe(mockNewRefreshToken);
      expect(mockRefreshTokenService.rotateRefreshToken).toHaveBeenCalledWith(
        mockRefreshToken,
        undefined,
        undefined,
      );
    });

    it('should handle token rotation errors', async () => {
      mockRefreshTokenService.rotateRefreshToken.mockRejectedValue(
        new Error('Token rotation failed'),
      );

      await expect(
        service.refreshAccessToken(mockRefreshToken),
      ).rejects.toThrow('Token rotation failed');
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      const refreshToken = 'refresh-token-to-revoke';
      mockRefreshTokenService.revokeToken.mockResolvedValue(undefined);

      await service.logout(refreshToken);

      expect(mockRefreshTokenService.revokeToken).toHaveBeenCalledWith(
        refreshToken,
      );
    });

    it('should handle revocation errors gracefully', async () => {
      const refreshToken = 'refresh-token-to-revoke';
      mockRefreshTokenService.revokeToken.mockRejectedValue(
        new Error('Token not found'),
      );

      await expect(service.logout(refreshToken)).rejects.toThrow(
        'Token not found',
      );
    });
  });

  describe('logoutAllDevices', () => {
    it('should revoke all user tokens', async () => {
      const userId = 'user-123';
      mockRefreshTokenService.revokeAllUserTokens.mockResolvedValue(undefined);

      await service.logoutAllDevices(userId);

      expect(mockRefreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        userId,
      );
    });

    it('should handle revocation errors', async () => {
      const userId = 'user-123';
      mockRefreshTokenService.revokeAllUserTokens.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.logoutAllDevices(userId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle JWT service errors during login', async () => {
      const mockUserForLogin = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(service.login(mockUserForLogin)).rejects.toThrow(
        'JWT signing failed',
      );
    });

    it('should handle refresh token generation errors during login', async () => {
      const mockUserForLogin = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockJwtService.sign.mockReturnValue('access-token');
      mockRefreshTokenService.generateRefreshToken.mockRejectedValue(
        new Error('Refresh token generation failed'),
      );

      await expect(service.login(mockUserForLogin)).rejects.toThrow(
        'Refresh token generation failed',
      );
    });

    it('should handle workspace creation failure during signup', async () => {
      const signupDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };

      const mockCreatedUser = {
        id: 'new-user-123',
        email: signupDto.email,
        name: signupDto.name,
      };

      mockUsersService.create.mockResolvedValue(mockCreatedUser);
      mockSubscriptionsService.createFreeSubscription.mockResolvedValue({});
      mockWorkspacesService.createPersonalWorkspace.mockRejectedValue(
        new Error('Workspace creation failed'),
      );

      await expect(service.signup(signupDto)).rejects.toThrow(
        'Workspace creation failed',
      );
    });
  });
});
