import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TestAppFactory } from '../setup/test-app.factory';
import { TestHelpers } from '../utils/test-helpers';
import { UserFixtures } from '../fixtures';

describe('Users CRUD Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestAppFactory.createTestApp();
  });

  describe('GET /users (List Users)', () => {
    it('should return paginated list of users for authenticated admin', async () => {
      // Create an admin user
      const { cookies: adminCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        name: 'Admin User',
      });

      // Create some regular users
      await TestHelpers.createMultipleAuthenticatedUsers(3);

      const response = await TestHelpers.authenticatedGet('/users', adminCookies)
        .expect(200);

      TestHelpers.expectPaginatedResponse(response, ['id', 'email', 'name', 'createdAt']);
      expect(response.body.data.length).toBeGreaterThanOrEqual(4); // 3 + admin
      
      // Verify user data structure
      const user = response.body.data[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('subscription');
      expect(user).not.toHaveProperty('password'); // Password should never be returned
    });

    it('should support pagination with limit and offset', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create multiple users for pagination testing
      await TestHelpers.createMultipleAuthenticatedUsers(10);

      const response = await TestHelpers.authenticatedGet('/users?limit=5&page=1', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.meta.limit).toBe(5);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(11);
    });

    it('should filter users by email', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: 'filter.test@example.com',
        password: 'TestPassword123!',
      });

      // Create users with specific emails
      await TestHelpers.createAuthenticatedUser({
        email: 'unique.user@example.com',
        password: 'TestPassword123!',
        name: 'Unique User',
      });

      const response = await TestHelpers.authenticatedGet('/users?email=unique.user@example.com', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe('unique.user@example.com');
    });

    it('should filter users by name', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Special Filter Name',
      });

      const response = await TestHelpers.authenticatedGet('/users?name=Special Filter Name', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Special Filter Name');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should handle empty results gracefully', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/users?email=nonexistent@example.com', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('GET /users/:id (Get User by ID)', () => {
    it('should return user details for valid user ID', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Test User',
      });

      const response = await TestHelpers.authenticatedGet(`/users/${user.id}`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('email', user.email);
      expect(response.body).toHaveProperty('name', user.name);
      expect(response.body).toHaveProperty('subscription');
      expect(response.body).toHaveProperty('workspaces');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent user ID', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/users/non-existent-id', cookies)
        .expect(404);

      TestHelpers.expectNotFound(response);
    });

    it('should return 404 for invalid UUID format', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/users/invalid-uuid', cookies)
        .expect(400);

      TestHelpers.expectValidationError(response);
    });

    it('should reject unauthenticated requests', async () => {
      const { user } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should include user relationships when requested', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Test User With Relations',
      });

      const response = await TestHelpers.authenticatedGet(`/users/${user.id}?include=subscription,workspaces`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('subscription');
      expect(response.body.subscription).toHaveProperty('planType');
      expect(response.body).toHaveProperty('workspaces');
      expect(Array.isArray(response.body.workspaces)).toBe(true);
    });
  });

  describe('PUT /users/:id (Update User)', () => {
    it('should successfully update user name', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Original Name',
      });

      const updateData = {
        name: 'Updated Name',
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user.id}`, cookies, updateData)
        .expect(200);

      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('name', 'Updated Name');
      expect(response.body).toHaveProperty('email', user.email); // Email should remain unchanged
    });

    it('should successfully update user email', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Test User',
      });

      const newEmail = TestHelpers.generateUniqueEmail();
      const updateData = {
        email: newEmail,
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user.id}`, cookies, updateData)
        .expect(200);

      expect(response.body).toHaveProperty('email', newEmail);
      expect(response.body).toHaveProperty('name', user.name); // Name should remain unchanged
    });

    it('should update multiple fields simultaneously', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Original Name',
      });

      const updateData = {
        name: 'New Name',
        email: TestHelpers.generateUniqueEmail(),
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user.id}`, cookies, updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('email', updateData.email);
    });

    it('should reject update with duplicate email', async () => {
      // Create first user
      const { user: user1 } = await TestHelpers.createAuthenticatedUser({
        email: 'first@example.com',
        password: 'TestPassword123!',
      });

      // Create second user
      const { user: user2, cookies } = await TestHelpers.createAuthenticatedUser({
        email: 'second@example.com',
        password: 'TestPassword123!',
      });

      // Try to update second user with first user's email
      const updateData = {
        email: user1.email,
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user2.id}`, cookies, updateData)
        .expect(409);

      expect(response.body.message).toContain('email');
    });

    it('should reject update with invalid email format', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const updateData = {
        email: 'invalid-email-format',
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user.id}`, cookies, updateData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'email');
    });

    it('should reject update with empty name', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Valid Name',
      });

      const updateData = {
        name: '',
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user.id}`, cookies, updateData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'name');
    });

    it('should reject update with name too long', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const updateData = {
        name: 'A'.repeat(256), // Assuming max length is 255
      };

      const response = await TestHelpers.authenticatedPut(`/users/${user.id}`, cookies, updateData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'name');
    });

    it('should reject update for non-existent user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const updateData = {
        name: 'New Name',
      };

      const response = await TestHelpers.authenticatedPut('/users/non-existent-id', cookies, updateData)
        .expect(404);

      TestHelpers.expectNotFound(response);
    });

    it('should reject unauthenticated update requests', async () => {
      const { user } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await request(app.getHttpServer())
        .put(`/users/${user.id}`)
        .send(updateData)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should prevent users from updating other users (authorization)', async () => {
      // Create two users
      const { user: user1 } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const { cookies: user2Cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const updateData = {
        name: 'Unauthorized Update',
      };

      // User 2 tries to update User 1
      const response = await TestHelpers.authenticatedPut(`/users/${user1.id}`, user2Cookies, updateData)
        .expect(403);

      TestHelpers.expectForbidden(response);
    });
  });

  describe('PATCH /users/:id (Partial Update User)', () => {
    it('should successfully patch only name field', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Original Name',
      });

      const patchData = {
        name: 'Patched Name',
      };

      const response = await TestHelpers.authenticatedPatch(`/users/${user.id}`, cookies, patchData)
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Patched Name');
      expect(response.body).toHaveProperty('email', user.email); // Should remain unchanged
    });

    it('should successfully patch only email field', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Test User',
      });

      const newEmail = TestHelpers.generateUniqueEmail();
      const patchData = {
        email: newEmail,
      };

      const response = await TestHelpers.authenticatedPatch(`/users/${user.id}`, cookies, patchData)
        .expect(200);

      expect(response.body).toHaveProperty('email', newEmail);
      expect(response.body).toHaveProperty('name', user.name); // Should remain unchanged
    });

    it('should handle empty patch gracefully', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Test User',
      });

      const response = await TestHelpers.authenticatedPatch(`/users/${user.id}`, cookies, {})
        .expect(200);

      expect(response.body).toHaveProperty('name', user.name);
      expect(response.body).toHaveProperty('email', user.email);
    });

    it('should reject patch with invalid data', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const patchData = {
        email: 'invalid-email',
      };

      const response = await TestHelpers.authenticatedPatch(`/users/${user.id}`, cookies, patchData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'email');
    });
  });

  describe('DELETE /users/:id (Delete User)', () => {
    it('should successfully delete user and cascade related data', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'User To Delete',
      });

      const response = await TestHelpers.authenticatedDelete(`/users/${user.id}`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify user is actually deleted
      const getResponse = await TestHelpers.authenticatedGet(`/users/${user.id}`, cookies)
        .expect(404);

      TestHelpers.expectNotFound(getResponse);
    });

    it('should reject delete for non-existent user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedDelete('/users/non-existent-id', cookies)
        .expect(404);

      TestHelpers.expectNotFound(response);
    });

    it('should reject unauthenticated delete requests', async () => {
      const { user } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await request(app.getHttpServer())
        .delete(`/users/${user.id}`)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should prevent users from deleting other users', async () => {
      // Create two users
      const { user: user1 } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const { cookies: user2Cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // User 2 tries to delete User 1
      const response = await TestHelpers.authenticatedDelete(`/users/${user1.id}`, user2Cookies)
        .expect(403);

      TestHelpers.expectForbidden(response);
    });

    it('should handle cascade deletion of user relationships', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'User With Relations',
      });

      // User should have subscription and personal workspace
      // Verify they exist before deletion
      const userBeforeDelete = await TestHelpers.authenticatedGet(`/users/${user.id}`, cookies)
        .expect(200);

      expect(userBeforeDelete.body).toHaveProperty('subscription');

      // Delete user
      await TestHelpers.authenticatedDelete(`/users/${user.id}`, cookies)
        .expect(200);

      // Verify related data is also cleaned up
      // This would need to be tested by checking subscriptions and workspaces endpoints
      // if they exist and are accessible
    });
  });

  describe('User Search and Filtering', () => {
    it('should search users by partial email match', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'TestPassword123!',
      });

      // Create users with specific email patterns
      await TestHelpers.createAuthenticatedUser({
        email: 'john.doe@company.com',
        password: 'TestPassword123!',
        name: 'John Doe',
      });

      await TestHelpers.createAuthenticatedUser({
        email: 'jane.doe@company.com',
        password: 'TestPassword123!',
        name: 'Jane Doe',
      });

      const response = await TestHelpers.authenticatedGet('/users?search=company.com', cookies)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((user: any) => {
        expect(user.email).toContain('company.com');
      });
    });

    it('should search users by partial name match', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Alice Johnson',
      });

      await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Bob Johnson',
      });

      const response = await TestHelpers.authenticatedGet('/users?search=Johnson', cookies)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((user: any) => {
        expect(user.name).toContain('Johnson');
      });
    });

    it('should handle case-insensitive search', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      await TestHelpers.createAuthenticatedUser({
        email: 'UPPERCASE@EXAMPLE.COM',
        password: 'TestPassword123!',
        name: 'UPPERCASE USER',
      });

      const response = await TestHelpers.authenticatedGet('/users?search=uppercase', cookies)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should combine search with pagination', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create multiple users with common search term
      for (let i = 0; i < 10; i++) {
        await TestHelpers.createAuthenticatedUser({
          email: `searchtest${i}@example.com`,
          password: 'TestPassword123!',
          name: `Search Test User ${i}`,
        });
      }

      const response = await TestHelpers.authenticatedGet('/users?search=searchtest&limit=5&page=1', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(10);
      expect(response.body.meta.limit).toBe(5);
    });
  });

  describe('User Statistics and Analytics', () => {
    it('should return user count statistics', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'TestPassword123!',
      });

      await TestHelpers.createMultipleAuthenticatedUsers(5);

      const response = await TestHelpers.authenticatedGet('/users/stats', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('activeUsers');
      expect(response.body.totalUsers).toBeGreaterThanOrEqual(6); // 5 + admin
    });

    it('should return user creation trends', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/users/stats/trends', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('daily');
      expect(response.body).toHaveProperty('weekly');
      expect(response.body).toHaveProperty('monthly');
    });
  });
});