import * as request from 'supertest';
import { TestHelpers } from '../utils/test-helpers';
import { WorkspaceFixtures } from '../fixtures';
import { DatabaseUtils } from '../setup/database-utils';

describe('Workspaces CRUD Integration Tests', () => {
  beforeAll(async () => {
    await DatabaseUtils.initializeDatabase();
  });

  beforeEach(async () => {
    await DatabaseUtils.cleanDatabase();
  });

  afterAll(async () => {
    await DatabaseUtils.closeDatabase();
  });

  describe('Workspace Management', () => {
    it('should get user workspaces', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: TestHelpers.generateUniquePassword(),
        name: 'Workspace User',
      });

      const response = await TestHelpers.authenticatedGet('/workspaces', cookies)
        .expect(200);

      // The response is directly an array, not wrapped in data property
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});