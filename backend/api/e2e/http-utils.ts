import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export class HttpUtils {
  private app: INestApplication;
  private baseURL: string;

  constructor(app: INestApplication, baseURL = '/api') {
    this.app = app;
    this.baseURL = baseURL;
  }

  /**
   * Create authenticated request with access token
   */
  authenticatedRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, accessToken: string) {
    return request(this.app.getHttpServer())
      [method](`${this.baseURL}${path}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Accept', 'application/json');
  }

  /**
   * Create request with cookies (for cookie-based auth)
   */
  cookieRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, cookies: string[]) {
    return request(this.app.getHttpServer())
      [method](`${this.baseURL}${path}`)
      .set('Cookie', cookies)
      .set('Accept', 'application/json');
  }

  /**
   * Regular request without authentication
   */
  request(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) {
    return request(this.app.getHttpServer())
      [method](`${this.baseURL}${path}`)
      .set('Accept', 'application/json');
  }

  /**
   * Extract cookies from response
   */
  static extractCookies(response: request.Response): { [key: string]: string } {
    const cookies: { [key: string]: string } = {};
    const setCookieHeader = response.headers['set-cookie'];
    
    if (!setCookieHeader) return cookies;
    
    const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    
    cookieArray.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      cookies[name.trim()] = value?.trim() || '';
    });
    
    return cookies;
  }

  /**
   * Convert cookies object to cookie array for requests
   */
  static cookiesToArray(cookies: { [key: string]: string }): string[] {
    return Object.entries(cookies).map(([name, value]) => `${name}=${value}`);
  }

  /**
   * Auth helper - signup and return tokens
   */
  async signup(userData: any): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    cookies: { [key: string]: string };
  }> {
    const response = await this.request('post', '/auth/signup')
      .send(userData)
      .expect(201);

    const cookies = HttpUtils.extractCookies(response);
    
    return {
      user: response.body.user,
      accessToken: cookies.access_token,
      refreshToken: cookies.refresh_token,
      cookies,
    };
  }

  /**
   * Auth helper - login and return tokens
   */
  async login(credentials: { email: string; password: string }): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
    cookies: { [key: string]: string };
  }> {
    const response = await this.request('post', '/auth/login')
      .send(credentials)
      .expect(200);

    const cookies = HttpUtils.extractCookies(response);
    
    return {
      user: response.body.user,
      accessToken: cookies.access_token,
      refreshToken: cookies.refresh_token,
      cookies,
    };
  }

  /**
   * AI helper - check credits
   */
  checkCredits(accessToken: string, aiRequest: any) {
    return this.authenticatedRequest('post', '/ai/chat/completions/check', accessToken)

      .send(aiRequest);
  }

  /**
   * AI helper - generate completion
   */
  generateCompletion(accessToken: string, aiRequest: any) {
    return this.authenticatedRequest('post', '/ai/chat/completions', accessToken)

      .send(aiRequest);
  }
}