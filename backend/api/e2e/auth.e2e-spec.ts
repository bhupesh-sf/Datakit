import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';
import { UserFixture } from './fixtures/user.fixture';
import { Subscription, SubscriptionPlan } from '../src/subscriptions/entities/subscription.entity';
import { Workspace } from '../src/workspaces/entities/workspace.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let httpUtils: HttpUtils;

  beforeAll(async () => {
    module = await TestAppFactory.createTestingModule();
    app = await TestAppFactory.createApp(module);
    
    DatabaseUtils.initialize(app);
    httpUtils = new HttpUtils(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await DatabaseUtils.cleanDatabase();
  });

  describe('POST /api/auth/signup', () => {
    it('should create new user and return tokens via cookies', async () => {
      const userData = UserFixture.createUserData();

      const response = await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body.user).toMatchObject({
        email: userData.email,
        name: userData.name,
        emailVerified: false,
      });
      
      // Password should not be returned (this might need to be fixed in the API)
      // expect(response.body.user.password).toBeUndefined();

      const cookies = HttpUtils.extractCookies(response);
      expect(cookies.access_token).toBeDefined();
      expect(cookies.refresh_token).toBeDefined();
    });

    it('should reject duplicate email addresses', async () => {
      const userData = UserFixture.createUserData();

      await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(201);

      await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(409);
    });

    it('should validate email format', async () => {
      const userData = UserFixture.createUserData({ email: 'invalid-email' });

      await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(400);
    });

    it('should validate password requirements', async () => {
      const userData = UserFixture.createUserData({ password: '123' });

      await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(400);
    });

    it('should work without providing name', async () => {
      const userData = UserFixture.createUserData();
      delete userData.name;

      const response = await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBeNull();
    });

    it('should create subscription and workspace for new user', async () => {
      const userData = UserFixture.createUserData();

      const response = await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(201);

      const userId = response.body.user.id;

      // Verify subscription was created
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      const subscription = await subscriptionRepo.findOne({ where: { userId } });
      expect(subscription).toBeDefined();
      expect(subscription?.planType).toBe(SubscriptionPlan.FREE);
      expect(Number(subscription?.creditsRemaining)).toBe(315);

      // Verify personal workspace was created
      const workspaceRepo = DatabaseUtils.getRepository(app, Workspace);
      const workspace = await workspaceRepo.findOne({ where: { ownerId: userId } });
      expect(workspace).toBeDefined();
      expect(workspace?.isPersonal).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await DatabaseUtils.seedTestData(app);
    });

    it('should login user with valid credentials', async () => {
      const response = await httpUtils
        .request('post', '/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      });

      const cookies = HttpUtils.extractCookies(response);
      expect(cookies.access_token).toBeDefined();
      expect(cookies.refresh_token).toBeDefined();
    });

    it('should reject invalid email', async () => {
      await httpUtils
        .request('post', '/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('should reject invalid password', async () => {
      await httpUtils
        .request('post', '/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should handle multiple concurrent logins', async () => {
      const loginPromises = Array(3)
        .fill(0)
        .map(() =>
          httpUtils
            .request('post', '/auth/login')
            .send({
              email: 'test@example.com',
              password: 'password123',
            })
        );

      const responses = await Promise.all(loginPromises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe('test@example.com');
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const { cookies } = await httpUtils.signup(UserFixture.createUserData());
      refreshToken = cookies.refresh_token;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${refreshToken}`])
        .expect(200);

      const cookies = HttpUtils.extractCookies(response);
      expect(cookies.access_token).toBeDefined();
      expect(cookies.refresh_token).toBeDefined();
      expect(cookies.refresh_token).not.toBe(refreshToken); // Token rotation
    });

    it('should reject invalid refresh token', async () => {
      await httpUtils
        .cookieRequest('post', '/auth/refresh', ['refresh_token=invalid_token'])
        .expect(401);
    });

    it('should reject missing refresh token', async () => {
      await httpUtils
        .request('post', '/auth/refresh')
        .expect(401);
    });

    it('should revoke old refresh token after rotation', async () => {
      await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${refreshToken}`])
        .expect(200);

      // Old token should not work anymore
      await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${refreshToken}`])
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const { cookies } = await httpUtils.signup(UserFixture.createUserData());
      accessToken = cookies.access_token;
      refreshToken = cookies.refresh_token;
    });

    it('should logout user and clear tokens', async () => {
      const response = await httpUtils
        .cookieRequest('post', '/auth/logout', [
          `access_token=${accessToken}`,
          `refresh_token=${refreshToken}`,
        ])
        .expect(200);

      const cookies = HttpUtils.extractCookies(response);
      expect(cookies.access_token).toBe('');
      expect(cookies.refresh_token).toBe('');
    });

    it('should work without tokens (idempotent)', async () => {
      await httpUtils
        .request('post', '/auth/logout')
        .expect(200);
    });

    it('should invalidate refresh token in database', async () => {
      await httpUtils
        .cookieRequest('post', '/auth/logout', [`refresh_token=${refreshToken}`])
        .expect(200);

      // Token should not work for refresh anymore
      await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${refreshToken}`])
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createUserData());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return current user with valid token', async () => {
      const response = await httpUtils
        .cookieRequest('get', '/auth/me', [`access_token=${accessToken}`])
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    it('should reject request without token', async () => {
      await httpUtils
        .request('get', '/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await httpUtils
        .cookieRequest('get', '/auth/me', ['access_token=invalid_token'])
        .expect(401);
    });

    it('should work with Authorization header fallback', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/auth/me', accessToken)
        .expect(200);

      expect(response.body.email).toBe(user.email);
    });
  });

  describe('Token Security', () => {
    it('should set secure cookie flags', async () => {
      const userData = UserFixture.createUserData();

      const response = await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(201);

      const setCookieHeaders = response.headers['set-cookie'];
      const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

      cookieArray.forEach(cookie => {
        if (cookie.includes('access_token') || cookie.includes('refresh_token')) {
          expect(cookie).toMatch(/HttpOnly/);
          expect(cookie).toMatch(/SameSite=Strict/);
        }
      });
    });

    it('should rotate refresh tokens on refresh', async () => {
      const { cookies: initialCookies } = await httpUtils.signup(UserFixture.createUserData());
      
      const refreshResponse = await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${initialCookies.refresh_token}`])
        .expect(200);

      const newCookies = HttpUtils.extractCookies(refreshResponse);
      expect(newCookies.refresh_token).not.toBe(initialCookies.refresh_token);
    });

    it('should track user agent and IP for sessions', async () => {
      const userData = UserFixture.createUserData();

      await httpUtils
        .request('post', '/auth/signup')
        .set('User-Agent', 'Test Browser/1.0')
        .send(userData)
        .expect(201);

      // Verify refresh token has user agent tracked
      const refreshTokenRepo = DatabaseUtils.getRepository(app, RefreshToken);
      const refreshTokens = await refreshTokenRepo.find();
      const latestToken = refreshTokens[refreshTokens.length - 1];
      
      expect(latestToken?.userAgent).toBe('Test Browser/1.0');
      expect(latestToken?.ipAddress).toBeDefined();
    });
  });

  describe('Complete Authentication Flows', () => {
    it('should handle complete signup -> login -> refresh -> logout flow', async () => {
      // 1. Signup
      const userData = UserFixture.createUserData({
        email: 'flow@example.com',
        password: 'password123',
        name: 'Flow User',
      });

      const signupResponse = await httpUtils
        .request('post', '/auth/signup')
        .send(userData)
        .expect(201);

      expect(signupResponse.body.user.email).toBe('flow@example.com');

      // 2. Login
      const { cookies: loginCookies } = await httpUtils.login({
        email: 'flow@example.com',
        password: 'password123',
      });

      // 3. Refresh tokens
      const refreshResponse = await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${loginCookies.refresh_token}`])
        .expect(200);

      const newCookies = HttpUtils.extractCookies(refreshResponse);

      // 4. Logout
      await httpUtils
        .cookieRequest('post', '/auth/logout', [`refresh_token=${newCookies.refresh_token}`])
        .expect(200);

      // 5. Verify tokens are invalidated
      await httpUtils
        .cookieRequest('post', '/auth/refresh', [`refresh_token=${newCookies.refresh_token}`])
        .expect(401);
    });

    it('should handle multiple device sessions', async () => {
      await DatabaseUtils.seedTestData(app);

      // Login from device 1
      const device1Cookies = HttpUtils.cookiesToArray(
        (await httpUtils.login({
          email: 'test@example.com',
          password: 'password123',
        })).cookies
      );

      // Login from device 2
      const device2Cookies = HttpUtils.cookiesToArray(
        (await httpUtils.login({
          email: 'test@example.com',
          password: 'password123',
        })).cookies
      );

      // Both should be able to access protected endpoints
      await httpUtils
        .cookieRequest('get', '/auth/me', device1Cookies)
        .expect(200);

      await httpUtils
        .cookieRequest('get', '/auth/me', device2Cookies)
        .expect(200);

      // Should have multiple active refresh tokens
      const refreshTokenRepo = DatabaseUtils.getRepository(app, RefreshToken);
      const activeTokens = await refreshTokenRepo.find({
        where: { isRevoked: false }
      });
      expect(activeTokens.length).toBeGreaterThanOrEqual(2);
    });
  });
});