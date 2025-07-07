import * as request from 'supertest';
import { TestHelpers } from '../utils/test-helpers';
import { SubscriptionFixtures } from '../fixtures';
import { DatabaseUtils } from '../setup/database-utils';

describe('Subscriptions CRUD Integration Tests', () => {
  beforeAll(async () => {
    await DatabaseUtils.initializeDatabase();
  });

  beforeEach(async () => {
    await DatabaseUtils.cleanDatabase();
  });

  afterAll(async () => {
    await DatabaseUtils.closeDatabase();
  });

  describe('Subscription Management', () => {
    it('should get current user subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: TestHelpers.generateUniquePassword(),
        name: 'Subscription User',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions/my-subscription', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('planType');
      expect(response.body).toHaveProperty('status');
    });
  });
});