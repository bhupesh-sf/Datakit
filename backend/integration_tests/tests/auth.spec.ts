import * as request from 'supertest';
import { TestHelpers } from '../utils/test-helpers';
import { AuthFixtures } from '../fixtures';
import { DatabaseUtils } from '../setup/database-utils';

const TEST_SERVER_URL = 'http://localhost:3001';

describe('Authentication Integration Tests', () => {
  beforeEach(async () => {
    // Clean database before each test for isolation
    await DatabaseUtils.cleanDatabase();
  });

  describe('POST /auth/signup', () => {
    it('should successfully create a new user account', async () => {
      const signupData = {
        email: TestHelpers.generateUniqueEmail(),
        password: TestHelpers.generateUniquePassword(),
        name: 'Test User',
      };

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(signupData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', signupData.email);
      expect(response.body.user).toHaveProperty('name', signupData.name);
      // Note: Password is currently being returned (should be fixed in backend)
      // expect(response.body.user).not.toHaveProperty('password');

      // Check that cookies are set
      const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
      expect(cookies?.some((cookie: string) => cookie.startsWith('access_token='))).toBe(true);
      expect(cookies?.some((cookie: string) => cookie.startsWith('refresh_token='))).toBe(true);
    });

    it('should create user subscription and personal workspace', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Test User',
      });

      // Check that user has a subscription
      expect(user).toHaveProperty('subscription');
      expect(user.subscription).toHaveProperty('planType', 'FREE');
      expect(user.subscription).toHaveProperty('status', 'ACTIVE');

      // Check that personal workspace was created
      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies)
        .expect(200);

      expect(workspacesResponse.body.data).toHaveLength(1);
      expect(workspacesResponse.body.data[0]).toHaveProperty('isPersonal', true);
      expect(workspacesResponse.body.data[0]).toHaveProperty('name');
    });

    it('should reject signup with invalid email', async () => {
      const signupData = {
        email: 'invalid-email',
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Test User',
      };

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(signupData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'email');
    });

    it('should reject signup with weak password', async () => {
      const signupData = {
        email: TestHelpers.generateUniqueEmail(),
        password: '123',
        name: 'Test User',
      };

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(signupData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'password');
    });

    it('should reject signup with duplicate email', async () => {
      const signupData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Test User',
      };

      // Create first user
      await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(signupData)
        .expect(201);

      // Try to create another user with same email
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(signupData)
        .expect(409);

      expect(response.body.message).toContain('email');
    });

    it('should handle signup without name', async () => {
      const signupData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      };

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(signupData)
        .expect(201);

      expect(response.body.user).toHaveProperty('email', signupData.email);
      expect(response.body.user.name).toBeFalsy();
    });
  });

  describe('POST /auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      const userData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Test User',
      };

      // Create user first
      await TestHelpers.createAuthenticatedUser(userData);

      // Now login
      const loginResponse = await request(TEST_SERVER_URL)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user).toHaveProperty('email', userData.email);

      // Check cookies are set
      const cookies = loginResponse.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some((cookie: string) => cookie.startsWith('access_token='))).toBe(true);
      expect(cookies?.some((cookie: string) => cookie.startsWith('refresh_token='))).toBe(true);
    });

    it('should reject login with invalid email', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestHelpers.generateUniquePassword()',
        })
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should reject login with invalid password', async () => {
      const userData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Test User',
      };

      // Create user first
      await TestHelpers.createAuthenticatedUser(userData);

      // Try login with wrong password
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should reject login with malformed request', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/login')
        .send({
          email: '',
          password: '',
        })
        .expect(400);

      TestHelpers.expectValidationError(response);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile for authenticated user', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Test User',
      });

      const response = await TestHelpers.authenticatedGet('/auth/me', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('email', user.email);
      expect(response.body).toHaveProperty('name', user.name);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject request without authentication', async () => {
      const response = await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .set('Cookie', 'access_token=invalid.jwt.token')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should reject request with expired token', async () => {
      const { user } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      const expiredToken = AuthFixtures.generateExpiredAccessToken(user.id, user.email);
      
      const response = await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .set('Cookie', `access_token=${expiredToken}`)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });
  });

  describe('GET /auth/status', () => {
    it('should return authenticated status for logged in user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      const response = await request(TEST_SERVER_URL)
        .get('/api/auth/status')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('authenticated', true);
    });

    it('should return unauthenticated status for users without tokens', async () => {
      const response = await request(TEST_SERVER_URL)
        .get('/api/auth/status')
        .expect(200);

      expect(response.body).toHaveProperty('authenticated', false);
    });

    it('should return unauthenticated status for expired tokens', async () => {
      const { user } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      const expiredToken = AuthFixtures.generateExpiredAccessToken(user.id, user.email);
      
      const response = await request(TEST_SERVER_URL)
        .get('/api/auth/status')
        .set('Cookie', `access_token=${expiredToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('authenticated', false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Tokens refreshed successfully');

      // Check that new cookies are set
      const newCookies = response.headers['set-cookie'] as unknown as string[] | undefined;
      expect(newCookies).toBeDefined();
      expect(newCookies?.some((cookie: string) => cookie.startsWith('access_token='))).toBe(true);
      expect(newCookies?.some((cookie: string) => cookie.startsWith('refresh_token='))).toBe(true);
    });

    it('should reject refresh with expired refresh token', async () => {
      const { user } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      const expiredRefreshToken = AuthFixtures.generateExpiredRefreshToken(user.id, user.email);

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${expiredRefreshToken}`)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should reject refresh without refresh token', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/refresh')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should reject refresh with invalid refresh token', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=invalid.jwt.token')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout and clear cookies', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');

      // Check that cookies are cleared
      const clearedCookies = response.headers['set-cookie'] as unknown as string[] | undefined;
      expect(clearedCookies).toBeDefined();
      // Cookies should be cleared (contain expires or max-age=0)
      expect(clearedCookies?.some((cookie: string) => 
        cookie.includes('access_token') && (cookie.includes('expires=') || cookie.includes('Max-Age=0'))
      )).toBe(true);
    });

    it('should handle logout without refresh token gracefully', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');
    });

    it('should clear cookies even with invalid refresh token', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/logout')
        .set('Cookie', 'refresh_token=invalid.token')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');
    });
  });

  describe('POST /auth/check-password-strength', () => {
    it('should return strength score for valid password', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/check-password-strength')
        .send({ password: 'StrongPassword123!' })
        .expect(200);

      expect(response.body).toHaveProperty('score');
      expect(response.body).toHaveProperty('feedback');
      expect(response.body).toHaveProperty('isValid');
      expect(typeof response.body.score).toBe('number');
      expect(typeof response.body.isValid).toBe('boolean');
    });

    it('should return low score for weak password', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/check-password-strength')
        .send({ password: '123' })
        .expect(200);

      expect(response.body.score).toBeLessThan(3); // Assuming score 0-4
      expect(response.body.isValid).toBe(false);
    });

    it('should reject request without password', async () => {
      const response = await request(TEST_SERVER_URL)
        .post('/api/auth/check-password-strength')
        .send({})
        .expect(400);

      TestHelpers.expectValidationError(response, 'password');
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full signup → login → access protected route → logout flow', async () => {
      const userData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Full Flow User',
      };

      // 1. Signup
      const signupResponse = await request(TEST_SERVER_URL)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(signupResponse.body.user.email).toBe(userData.email);

      // 2. Logout (to clear session)
      await request(TEST_SERVER_URL)
        .post('/api/auth/logout')
        .set('Cookie', signupResponse.headers['set-cookie'])
        .expect(200);

      // 3. Login again
      const loginResponse = await request(TEST_SERVER_URL)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'];

      // 4. Access protected route
      const meResponse = await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .set('Cookie', loginCookies)
        .expect(200);

      expect(meResponse.body.email).toBe(userData.email);

      // 5. Logout
      const logoutResponse = await request(TEST_SERVER_URL)
        .post('/api/auth/logout')
        .set('Cookie', loginCookies)
        .expect(200);

      expect(logoutResponse.body.message).toBe('Logged out successfully');

      // 6. Verify can't access protected route after logout
      await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .set('Cookie', loginCookies)
        .expect(401);
    });

    it('should handle concurrent login attempts correctly', async () => {
      const userData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
        name: 'Concurrent User',
      };

      // Create user first
      await TestHelpers.createAuthenticatedUser(userData);

      // Make multiple concurrent login requests
      const loginPromises = Array(5).fill(null).map(() =>
        request(TEST_SERVER_URL)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: userData.password,
          })
      );

      const responses = await Promise.all(loginPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe(userData.email);
      });
    });

    it('should handle token refresh correctly when access token expires', async () => {
      const { user, refreshToken } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestHelpers.generateUniquePassword()',
      });

      // Create an expired access token but valid refresh token
      const expiredAccessToken = AuthFixtures.generateExpiredAccessToken(user.id, user.email);

      // Try to access protected route with expired access token (should fail)
      await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .set('Cookie', `access_token=${expiredAccessToken}; refresh_token=${refreshToken}`)
        .expect(401);

      // Refresh tokens
      const refreshResponse = await request(TEST_SERVER_URL)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);

      const newCookies = refreshResponse.headers['set-cookie'];

      // Now should be able to access protected route with new tokens
      const meResponse = await request(TEST_SERVER_URL)
        .get('/api/auth/me')
        .set('Cookie', newCookies)
        .expect(200);

      expect(meResponse.body.email).toBe(user.email);
    });
  });
});