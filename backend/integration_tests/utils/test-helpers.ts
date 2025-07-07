import * as request from 'supertest';
import { AuthFixtures } from '../fixtures';

const TEST_SERVER_URL = 'http://localhost:3001';

export class TestHelpers {
  static getServerUrl(): string {
    return TEST_SERVER_URL;
  }

  /**
   * Create a user and return auth tokens
   */
  static async createAuthenticatedUser(userData: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    cookies: string[];
  }> {
    // First signup the user
    const signupResponse = await request(TEST_SERVER_URL)
      .post('/api/auth/signup')
      .send(userData)
      .expect(201);

    // Extract cookies from the response
    const cookies = (signupResponse.headers['set-cookie'] as unknown as string[]) || [];
    
    // Extract tokens from cookies
    let accessToken = '';
    let refreshToken = '';
    
    cookies.forEach((cookie: string) => {
      if (cookie.startsWith('access_token=')) {
        accessToken = cookie.split('access_token=')[1].split(';')[0];
      }
      if (cookie.startsWith('refresh_token=')) {
        refreshToken = cookie.split('refresh_token=')[1].split(';')[0];
      }
    });

    return {
      user: signupResponse.body.user,
      accessToken,
      refreshToken,
      cookies,
    };
  }

  /**
   * Make an authenticated request with cookies
   */
  static authenticatedRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    cookies: string[],
    data?: any
  ): request.Test {
    const req = request(TEST_SERVER_URL)[method]('/api' + url);
    
    // Set cookies
    if (cookies.length > 0) {
      req.set('Cookie', cookies);
    }
    
    // Set data for non-GET requests
    if (data && method !== 'get') {
      req.send(data);
    }
    
    return req;
  }

  /**
   * Make an authenticated GET request
   */
  static authenticatedGet(url: string, cookies: string[]): request.Test {
    return this.authenticatedRequest('get', url, cookies);
  }

  /**
   * Make an authenticated POST request
   */
  static authenticatedPost(url: string, cookies: string[], data?: any): request.Test {
    return this.authenticatedRequest('post', url, cookies, data);
  }

  /**
   * Make an authenticated PUT request
   */
  static authenticatedPut(url: string, cookies: string[], data?: any): request.Test {
    return this.authenticatedRequest('put', url, cookies, data);
  }

  /**
   * Make an authenticated PATCH request
   */
  static authenticatedPatch(url: string, cookies: string[], data?: any): request.Test {
    return this.authenticatedRequest('patch', url, cookies, data);
  }

  /**
   * Make an authenticated DELETE request
   */
  static authenticatedDelete(url: string, cookies: string[]): request.Test {
    return this.authenticatedRequest('delete', url, cookies);
  }

  /**
   * Extract JWT token from cookie string
   */
  static extractTokenFromCookie(cookies: string[], tokenName: 'access_token' | 'refresh_token'): string | null {
    for (const cookie of cookies) {
      if (cookie.startsWith(`${tokenName}=`)) {
        return cookie.split(`${tokenName}=`)[1].split(';')[0];
      }
    }
    return null;
  }

  /**
   * Create a request with Bearer token authorization
   */
  static requestWithBearer(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    token: string,
    data?: any
  ): request.Test {
    const req = request(TEST_SERVER_URL)[method]('/api' + url)
      .set('Authorization', `Bearer ${token}`);
    
    if (data && method !== 'get') {
      req.send(data);
    }
    
    return req;
  }

  /**
   * Login with credentials and return auth info
   */
  static async loginUser(credentials: {
    email: string;
    password: string;
  }): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    cookies: string[];
  }> {
    const loginResponse = await request(TEST_SERVER_URL)
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);

    const cookies = (loginResponse.headers['set-cookie'] as unknown as string[]) || [];
    
    let accessToken = '';
    let refreshToken = '';
    
    cookies.forEach((cookie: string) => {
      if (cookie.startsWith('access_token=')) {
        accessToken = cookie.split('access_token=')[1].split(';')[0];
      }
      if (cookie.startsWith('refresh_token=')) {
        refreshToken = cookie.split('refresh_token=')[1].split(';')[0];
      }
    });

    return {
      user: loginResponse.body.user,
      accessToken,
      refreshToken,
      cookies,
    };
  }

  /**
   * Generate test data with unique identifiers
   */
  static generateUniqueEmail(): string {
    return `test${Date.now()}${Math.random().toString(36).substring(2)}@example.com`;
  }

  static generateUniqueName(): string {
    return `Test User ${Date.now()}`;
  }

  /**
   * Wait for a specified amount of time (useful for testing time-sensitive features)
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Expect a validation error response
   */
  static expectValidationError(response: request.Response, field?: string): void {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    
    if (field) {
      expect(response.body.message).toContain(field);
    }
  }

  /**
   * Expect an unauthorized error response
   */
  static expectUnauthorized(response: request.Response): void {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  }

  /**
   * Expect a forbidden error response
   */
  static expectForbidden(response: request.Response): void {
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
  }

  /**
   * Expect a not found error response
   */
  static expectNotFound(response: request.Response): void {
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
  }

  /**
   * Create multiple authenticated users for testing
   */
  static async createMultipleAuthenticatedUsers(count: number): Promise<Array<{
    user: any;
    accessToken: string;
    refreshToken: string;
    cookies: string[];
  }>> {
    const users = [];
    
    for (let i = 0; i < count; i++) {
      const userData = {
        email: this.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: `Test User ${i}`,
      };
      
      const authUser = await this.createAuthenticatedUser(userData);
      users.push(authUser);
    }
    
    return users;
  }

  /**
   * Verify response has correct structure for paginated results
   */
  static expectPaginatedResponse(response: request.Response, expectedProperties: string[] = []): void {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(response.body.meta).toHaveProperty('total');
    expect(response.body.meta).toHaveProperty('page');
    expect(response.body.meta).toHaveProperty('limit');
    expect(Array.isArray(response.body.data)).toBe(true);

    if (expectedProperties.length > 0 && response.body.data.length > 0) {
      expectedProperties.forEach(prop => {
        expect(response.body.data[0]).toHaveProperty(prop);
      });
    }
  }

  /**
   * Test rate limiting by making multiple requests quickly
   */
  static async testRateLimit(
    makeRequest: () => Promise<request.Response>,
    maxRequests: number = 10
  ): Promise<boolean> {
    const requests = [];
    
    for (let i = 0; i < maxRequests; i++) {
      requests.push(makeRequest());
    }
    
    const responses = await Promise.all(requests);
    
    // Check if any request was rate limited (429 status)
    return responses.some(response => response.status === 429);
  }
}