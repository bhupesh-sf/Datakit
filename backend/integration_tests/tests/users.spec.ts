import * as request from 'supertest';
import { TestHelpers } from '../utils/test-helpers';
import { UserFixtures } from '../fixtures';
import { DatabaseUtils } from '../setup/database-utils';

describe('Users CRUD Integration Tests', () => {
  beforeAll(async () => {
    await DatabaseUtils.initializeDatabase();
  });

  beforeEach(async () => {
    await DatabaseUtils.cleanDatabase();
  });

  afterAll(async () => {
    await DatabaseUtils.closeDatabase();
  });

  describe('User Authentication Setup', () => {
    it('should get current user profile', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: TestHelpers.generateUniquePassword(),
        name: 'Test User',
      });

      const response = await TestHelpers.authenticatedGet('/auth/me', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('name');
    });
  });
});