import * as request from 'supertest';
import { TestHelpers } from '../utils/test-helpers';
import { CreditFixtures } from '../fixtures';
import { DatabaseUtils } from '../setup/database-utils';

describe('Credits CRUD Integration Tests', () => {
  beforeAll(async () => {
    await DatabaseUtils.initializeDatabase();
  });

  beforeEach(async () => {
    await DatabaseUtils.cleanDatabase();
  });

  afterAll(async () => {
    await DatabaseUtils.closeDatabase();
  });

  describe('Credit Management', () => {
    it('should get remaining credits', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: TestHelpers.generateUniquePassword(),
        name: 'Credit User',
      });

      const response = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('creditsRemaining');
      // Credits are returned as string numbers from API
      expect(typeof response.body.creditsRemaining).toBe('string');
      expect(parseFloat(response.body.creditsRemaining)).toBeGreaterThan(0);
    });
  });
});