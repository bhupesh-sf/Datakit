import * as request from 'supertest';
import { TestHelpers } from '../utils/test-helpers';
import { IntegratedFixtures } from '../fixtures';
import { DatabaseUtils } from '../setup/database-utils';

describe('Business Logic Integration Tests', () => {
  beforeAll(async () => {
    await DatabaseUtils.initializeDatabase();
  });

  beforeEach(async () => {
    await DatabaseUtils.cleanDatabase();
  });

  afterAll(async () => {
    await DatabaseUtils.closeDatabase();
  });

  describe('User Onboarding Flow', () => {
    it('should complete full user onboarding with all related entities', async () => {
      // 1. User signs up
      const signupData = {
        email: TestHelpers.generateUniqueEmail(),
        password: TestHelpers.generateUniquePassword(),
        name: 'Onboarding User',
      };

      const { user, cookies } = await TestHelpers.createAuthenticatedUser(signupData);

      // 2. Verify user has subscription
      expect(user).toHaveProperty('subscription');
      expect(user.subscription.planType).toBe('free');
      expect(user.subscription.status).toBe('active');

      // 3. Verify personal workspace was created
      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies)
        .expect(200);

      expect(workspacesResponse.body.data).toHaveLength(1);
      const personalWorkspace = workspacesResponse.body.data[0];
      expect(personalWorkspace.isPersonal).toBe(true);
      expect(personalWorkspace.members).toHaveLength(1);
      expect(personalWorkspace.members[0].role).toBe('OWNER');

      // 4. Verify user has initial credits
      const creditsResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      expect(creditsResponse.body.creditsRemaining).toBeGreaterThan(0);

      // 5. Verify user profile is complete
      const profileResponse = await TestHelpers.authenticatedGet('/auth/me', cookies)
        .expect(200);

      expect(profileResponse.body.email).toBe(signupData.email);
      expect(profileResponse.body.name).toBe(signupData.name);
    });
  });
});