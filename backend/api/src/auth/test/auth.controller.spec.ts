import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
    ip: '192.168.1.1',
    connection: { remoteAddress: '192.168.1.1' },
    get: jest.fn((header: string) => {
      if (header === 'User-Agent') return 'Mozilla/5.0 Test Browser';
      return undefined;
    }),
    cookies: {
      refresh_token: 'valid-refresh-token',
    },
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    json: jest.fn(),
  };

  const mockAuthService = {
    login: jest.fn(),
    signup: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockLoginResult = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
    };

    it('should login user and set httpOnly cookies', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      const result = await controller.login(
        mockRequest,
        mockResponse,
        loginDto,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith(
        mockRequest.user,
        mockRequest.ip,
        'Mozilla/5.0 Test Browser',
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockLoginResult.access_token,
        {
          httpOnly: true,
          secure: false, // NODE_ENV is not 'production' in tests
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000, // 15 minutes
        },
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockLoginResult.refresh_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        user: mockLoginResult.user,
      });
    });

    it('should set secure cookies in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(mockRequest, mockResponse, loginDto);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockLoginResult.access_token,
        expect.objectContaining({
          secure: true,
        }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockLoginResult.refresh_token,
        expect.objectContaining({
          secure: true,
        }),
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle missing IP address gracefully', async () => {
      const requestWithoutIp = {
        ...mockRequest,
        ip: undefined,
        connection: { remoteAddress: undefined },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(requestWithoutIp, mockResponse, loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        mockRequest.user,
        undefined,
        'Mozilla/5.0 Test Browser',
      );
    });

    it('should use connection.remoteAddress as fallback for IP', async () => {
      const requestWithConnectionIp = {
        ...mockRequest,
        ip: undefined,
        connection: { remoteAddress: '10.0.0.1' },
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(requestWithConnectionIp, mockResponse, loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        mockRequest.user,
        '10.0.0.1',
        'Mozilla/5.0 Test Browser',
      );
    });

    it('should handle auth service errors', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login(mockRequest, mockResponse, loginDto),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('signup', () => {
    const signupDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    };

    const mockSignupResult = {
      user: {
        id: 'new-user-123',
        email: 'newuser@example.com',
        name: 'New User',
      },
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
    };

    it('should signup user and set httpOnly cookies', async () => {
      mockAuthService.signup.mockResolvedValue(mockSignupResult);
      mockResponse.json.mockReturnValue({ user: mockSignupResult.user });

      const result = await controller.signup(
        mockRequest,
        mockResponse,
        signupDto,
      );

      expect(mockAuthService.signup).toHaveBeenCalledWith(
        signupDto,
        mockRequest.ip,
        'Mozilla/5.0 Test Browser',
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockSignupResult.access_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        },
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockSignupResult.refresh_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        user: mockSignupResult.user,
      });
    });

    it('should handle signup errors', async () => {
      mockAuthService.signup.mockRejectedValue(
        new Error('Email already exists'),
      );

      await expect(
        controller.signup(mockRequest, mockResponse, signupDto),
      ).rejects.toThrow('Email already exists');

      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return user from request', () => {
      const result = controller.getProfile(mockRequest);

      expect(result).toEqual(mockRequest.user);
    });

    it('should handle request without user', () => {
      const requestWithoutUser = { ...mockRequest, user: undefined };

      const result = controller.getProfile(requestWithoutUser);

      expect(result).toBeUndefined();
    });
  });

  describe('refresh', () => {
    const mockRefreshResult = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    };

    it('should refresh tokens and set new httpOnly cookies', async () => {
      mockAuthService.refreshAccessToken.mockResolvedValue(mockRefreshResult);
      mockResponse.json.mockReturnValue({
        message: 'Tokens refreshed successfully',
      });

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(
        'valid-refresh-token',
        mockRequest.ip,
        'Mozilla/5.0 Test Browser',
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockRefreshResult.access_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
        },
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockRefreshResult.refresh_token,
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        },
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Tokens refreshed successfully',
      });
    });

    it('should throw UnauthorizedException when no refresh token in cookies', async () => {
      const requestWithoutRefreshToken = {
        ...mockRequest,
        cookies: {},
      };

      await expect(
        controller.refresh(requestWithoutRefreshToken, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.refresh(requestWithoutRefreshToken, mockResponse),
      ).rejects.toThrow('No refresh token provided');

      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when cookies object is undefined', async () => {
      const requestWithoutCookies = {
        ...mockRequest,
        cookies: undefined,
      };

      await expect(
        controller.refresh(requestWithoutCookies, mockResponse),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should handle refresh service errors', async () => {
      mockAuthService.refreshAccessToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(
        controller.refresh(mockRequest, mockResponse),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout user and clear cookies', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      mockResponse.json.mockReturnValue({ message: 'Logged out successfully' });

      const result = await controller.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should still clear cookies even when no refresh token is present', async () => {
      const requestWithoutRefreshToken = {
        ...mockRequest,
        cookies: {},
      };

      mockResponse.json.mockReturnValue({ message: 'Logged out successfully' });

      await controller.logout(requestWithoutRefreshToken, mockResponse);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });

    it('should handle logout service errors gracefully', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('Token not found'));

      await expect(
        controller.logout(mockRequest, mockResponse),
      ).rejects.toThrow('Token not found');

      // Cookies should not be cleared if logout fails
      expect(mockResponse.clearCookie).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle missing cookies object', async () => {
      const requestWithoutCookies = {
        ...mockRequest,
        cookies: undefined,
      };

      mockResponse.json.mockReturnValue({ message: 'Logged out successfully' });

      await controller.logout(requestWithoutCookies, mockResponse);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token');
    });
  });

  describe('cookie security configurations', () => {
    const mockLoginResult = {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    };

    it('should use correct cookie configurations for access token', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(mockRequest, mockResponse, {
        email: 'test',
        password: 'test',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000, // Exactly 15 minutes
        }),
      );
    });

    it('should use correct cookie configurations for refresh token', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(mockRequest, mockResponse, {
        email: 'test',
        password: 'test',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // Exactly 7 days
        }),
      );
    });

    it('should have identical cookie configurations across login, signup, and refresh', async () => {
      const expectedAccessTokenConfig = {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      };

      const expectedRefreshTokenConfig = {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      // Test login
      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });
      await controller.login(mockRequest, mockResponse, {
        email: 'test',
        password: 'test',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expectedAccessTokenConfig,
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expectedRefreshTokenConfig,
      );

      jest.clearAllMocks();

      // Test signup
      mockAuthService.signup.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });
      await controller.signup(mockRequest, mockResponse, {
        email: 'test',
        password: 'test',
        name: 'Test',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expectedAccessTokenConfig,
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expectedRefreshTokenConfig,
      );

      jest.clearAllMocks();

      // Test refresh
      const mockRefreshResult = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };
      mockAuthService.refreshAccessToken.mockResolvedValue(mockRefreshResult);
      mockResponse.json.mockReturnValue({
        message: 'Tokens refreshed successfully',
      });
      await controller.refresh(mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        expect.any(String),
        expectedAccessTokenConfig,
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expectedRefreshTokenConfig,
      );
    });
  });

  describe('request metadata extraction', () => {
    it('should extract IP address and user agent correctly', async () => {
      const customRequest = {
        ...mockRequest,
        ip: '203.0.113.1',
        get: jest.fn().mockReturnValue('Custom User Agent'),
      };

      const mockLoginResult = {
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(customRequest, mockResponse, {
        email: 'test',
        password: 'test',
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(
        customRequest.user,
        '203.0.113.1',
        'Custom User Agent',
      );
      expect(customRequest.get).toHaveBeenCalledWith('User-Agent');
    });

    it('should handle missing user agent header', async () => {
      const requestWithoutUserAgent = {
        ...mockRequest,
        get: jest.fn().mockReturnValue(undefined),
      };

      const mockLoginResult = {
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);
      mockResponse.json.mockReturnValue({ user: mockLoginResult.user });

      await controller.login(requestWithoutUserAgent, mockResponse, {
        email: 'test',
        password: 'test',
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(
        requestWithoutUserAgent.user,
        mockRequest.ip,
        undefined,
      );
    });
  });
});
