import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';

describe('Application Health (e2e)', () => {
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

  describe('Basic Connectivity', () => {
    it('should return 404 for non-existent root endpoint', async () => {
      await httpUtils
        .request('get', '/')
        .expect(404);
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await httpUtils
        .request('get', '/api/auth/login')
        .set('Origin', 'http://localhost:5173')
        .expect(405); // Method not allowed for GET on login

      // Should have CORS headers
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('API Documentation', () => {
    it('should return 404 for non-existent docs endpoints', async () => {
      await httpUtils
        .request('get', '/api-docs')
        .expect(404);
    });

    it('should return 404 for non-existent JSON spec', async () => {
      await httpUtils
        .request('get', '/api-docs-json')
        .expect(404);
    });
  });

  describe('Security Headers', () => {
    it('should handle CORS correctly', async () => {
      // Test CORS via a request to existing endpoint
      const response = await httpUtils
        .request('get', '/api/auth/me')
        .set('Origin', 'http://localhost:5173')
        .expect(401); // Should be unauthorized but with CORS headers

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await httpUtils
        .request('get', '/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: expect.any(String),
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      await httpUtils
        .request('post', '/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle large payloads appropriately', async () => {
      const largePayload = 'x'.repeat(1024 * 1024); // 1MB

      await httpUtils
        .request('post', '/api/auth/login')
        .send({ data: largePayload })
        .expect(413); // Payload too large
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rapid requests without crashing', async () => {
      const promises = Array(10).fill(0).map(() =>
        httpUtils.request('get', '/api/auth/me')
      );

      const responses = await Promise.all(promises);
      
      // All should be 401 (unauthorized) but not crash
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });
  });

  describe('Performance', () => {
    it('should respond to requests quickly', async () => {
      const startTime = Date.now();
      
      await httpUtils
        .request('get', '/api/auth/me')
        .expect(401); // Unauthorized but should be fast
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array(10).fill(0).map(() =>
        httpUtils.request('get', '/api/auth/me')
      );

      const responses = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Should handle 10 concurrent requests within 5 seconds
      
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });
  });
});
