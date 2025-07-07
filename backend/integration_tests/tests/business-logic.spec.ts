import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TestAppFactory } from '../setup/test-app.factory';
import { TestHelpers } from '../utils/test-helpers';
import { IntegratedFixtures } from '../fixtures';

describe('Business Logic Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestAppFactory.createTestApp();
  });

  describe('User Onboarding Flow', () => {
    it('should complete full user onboarding with all related entities', async () => {
      // 1. User signs up
      const signupData = {
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Onboarding User',
      };

      const signupResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(signupData)
        .expect(201);

      const user = signupResponse.body.user;
      const cookies = signupResponse.headers['set-cookie'];

      // 2. Verify user has subscription
      expect(user).toHaveProperty('subscription');
      expect(user.subscription.planType).toBe('FREE');
      expect(user.subscription.status).toBe('ACTIVE');

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
      expect(creditsResponse.body.planType).toBe('FREE');

      // 5. Verify user can access their profile
      const profileResponse = await TestHelpers.authenticatedGet('/auth/me', cookies)
        .expect(200);

      expect(profileResponse.body.email).toBe(signupData.email);
      expect(profileResponse.body.name).toBe(signupData.name);
    });

    it('should handle onboarding failure scenarios gracefully', async () => {
      // Test with duplicate email
      const existingUser = await TestHelpers.createAuthenticatedUser({
        email: 'existing@example.com',
        password: 'TestPassword123!',
      });

      const duplicateSignup = {
        email: 'existing@example.com',
        password: 'DifferentPassword123!',
        name: 'Duplicate User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(duplicateSignup)
        .expect(409);

      expect(response.body.message).toContain('email');
    });
  });

  describe('Subscription and Credit Management', () => {
    it('should enforce credit limits based on subscription plan', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get FREE plan credit limit
      const freeCreditsResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const freeCreditLimit = freeCreditsResponse.body.creditsLimit;

      // Use all FREE credits
      if (freeCreditLimit > 0) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 1000,
          outputTokens: 500,
          creditsUsed: freeCreditLimit,
        });

        // Verify no more credits can be used
        const exhaustedUsage = await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.0,
        })
        .expect(402);

        expect(exhaustedUsage.body.message).toContain('insufficient');

        // Upgrade to PRO plan
        await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, {
          planType: 'PRO',
          paymentMethodId: 'pm_card_visa',
        });

        // Should now be able to use credits again
        const proUsage = await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.0,
        })
        .expect(201);

        expect(proUsage.body.creditsUsed).toBe(1.0);
      }
    });

    it('should handle subscription downgrades correctly', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to PRO
      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      });

      // Use some PRO credits
      await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 500,
        outputTokens: 250,
        creditsUsed: 10.0,
      });

      // Schedule downgrade to STARTER
      const downgradeResponse = await TestHelpers.authenticatedPost('/subscriptions/downgrade', cookies, {
        planType: 'STARTER',
      });

      expect(downgradeResponse.body.planType).toBe('PRO'); // Still current
      expect(downgradeResponse.body.scheduledDowngrade.planType).toBe('STARTER');

      // Credits should still be available until downgrade takes effect
      const creditsAfterDowngrade = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      expect(creditsAfterDowngrade.body.creditsRemaining).toBeGreaterThan(0);
    });

    it('should handle subscription cancellation and reactivation', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to STARTER
      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      });

      // Cancel subscription
      const cancelResponse = await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, {
        reason: 'Testing cancellation flow',
      });

      expect(cancelResponse.body.status).toBe('CANCELED');
      expect(cancelResponse.body.canceledAt).toBeTruthy();

      // Credits should still be available until period end
      const creditsAfterCancel = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      expect(creditsAfterCancel.body.creditsRemaining).toBeGreaterThan(0);

      // Reactivate subscription
      const reactivateResponse = await TestHelpers.authenticatedPost('/subscriptions/reactivate', cookies, {
        paymentMethodId: 'pm_card_visa',
      });

      expect(reactivateResponse.body.status).toBe('ACTIVE');
      expect(reactivateResponse.body.canceledAt).toBeFalsy();
    });
  });

  describe('Workspace Collaboration Logic', () => {
    it('should handle team workspace creation and member management', async () => {
      // Create workspace owner
      const { user: owner, cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@teamtest.com',
        password: 'TestPassword123!',
        name: 'Team Owner',
      });

      // Create team members
      const members = await TestHelpers.createMultipleAuthenticatedUsers(3);

      // Create team workspace
      const workspaceData = {
        name: 'Team Collaboration Workspace',
        description: 'A workspace for testing team features',
      };

      const workspaceResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = workspaceResponse.body.id;

      // Add members with different roles
      const roles = ['ADMIN', 'MEMBER', 'VIEWER'];
      for (let i = 0; i < members.length; i++) {
        const memberData = {
          userId: members[i].user.id,
          role: roles[i],
        };

        await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
          .expect(201);
      }

      // Verify members can access workspace based on their roles
      const adminMember = members.find((m, i) => roles[i] === 'ADMIN');
      const regularMember = members.find((m, i) => roles[i] === 'MEMBER');
      const viewerMember = members.find((m, i) => roles[i] === 'VIEWER');

      // Admin should be able to view workspace
      const adminAccess = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, adminMember.cookies)
        .expect(200);

      expect(adminAccess.body.name).toBe(workspaceData.name);

      // Member should be able to view workspace
      await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, regularMember.cookies)
        .expect(200);

      // Viewer should be able to view workspace
      await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, viewerMember.cookies)
        .expect(200);

      // Regular member should NOT be able to add new members
      const newMemberData = {
        userId: owner.id, // Try to add owner as member
        role: 'MEMBER',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, regularMember.cookies, newMemberData)
        .expect(403);

      // Admin SHOULD be able to add new members
      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, adminMember.cookies, newMemberData)
        .expect(201);
    });

    it('should enforce workspace permissions correctly', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@permissions.com',
        password: 'TestPassword123!',
      });

      const { user: member, cookies: memberCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'member@permissions.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, {
        name: 'Permission Test Workspace',
      });

      const workspaceId = workspaceResponse.body.id;

      // Add member with VIEWER role
      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, {
        userId: member.id,
        role: 'VIEWER',
      });

      // Member should be able to view workspace
      await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, memberCookies)
        .expect(200);

      // Member should NOT be able to update workspace
      await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}`, memberCookies, {
        name: 'Updated Name',
      })
      .expect(403);

      // Member should NOT be able to delete workspace
      await TestHelpers.authenticatedDelete(`/workspaces/${workspaceId}`, memberCookies)
        .expect(403);

      // Member should NOT be able to add other members
      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, memberCookies, {
        userId: 'some-user-id',
        role: 'MEMBER',
      })
      .expect(403);
    });

    it('should handle workspace deletion cascade correctly', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@cascade.com',
        password: 'TestPassword123!',
      });

      const { user: member } = await TestHelpers.createAuthenticatedUser({
        email: 'member@cascade.com',
        password: 'TestPassword123!',
      });

      // Create workspace with member
      const workspaceResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, {
        name: 'Cascade Delete Test',
      });

      const workspaceId = workspaceResponse.body.id;

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, {
        userId: member.id,
        role: 'MEMBER',
      });

      // Verify member exists
      const membersResponse = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}/members`, ownerCookies);
      expect(membersResponse.body.data.length).toBe(2); // Owner + Member

      // Delete workspace
      await TestHelpers.authenticatedDelete(`/workspaces/${workspaceId}`, ownerCookies)
        .expect(200);

      // Verify workspace is deleted
      await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, ownerCookies)
        .expect(404);

      // Verify workspace no longer appears in owner's workspace list
      const workspacesAfterDelete = await TestHelpers.authenticatedGet('/workspaces', ownerCookies);
      const deletedWorkspace = workspacesAfterDelete.body.data.find((w: any) => w.id === workspaceId);
      expect(deletedWorkspace).toBeUndefined();
    });
  });

  describe('Credit Usage and Workspace Tracking', () => {
    it('should track credit usage by workspace', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get user's personal workspace
      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies);
      const personalWorkspace = workspacesResponse.body.data.find((w: any) => w.isPersonal);

      // Create team workspace
      const teamWorkspaceResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, {
        name: 'Credit Tracking Workspace',
      });

      const teamWorkspaceId = teamWorkspaceResponse.body.id;

      // Use credits in personal workspace
      await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
        workspaceId: personalWorkspace.id,
      });

      // Use credits in team workspace
      await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'SQL_GENERATION',
        model: 'datakit-smart',
        inputTokens: 200,
        outputTokens: 100,
        creditsUsed: 3.0,
        workspaceId: teamWorkspaceId,
      });

      // Get usage by workspace
      const personalUsageResponse = await TestHelpers.authenticatedGet(`/credits/usage?workspaceId=${personalWorkspace.id}`, cookies);
      const teamUsageResponse = await TestHelpers.authenticatedGet(`/credits/usage?workspaceId=${teamWorkspaceId}`, cookies);

      expect(personalUsageResponse.body.data).toHaveLength(1);
      expect(personalUsageResponse.body.data[0].operation).toBe('AI_COMPLETION');

      expect(teamUsageResponse.body.data).toHaveLength(1);
      expect(teamUsageResponse.body.data[0].operation).toBe('SQL_GENERATION');
    });

    it('should aggregate workspace credit statistics correctly', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, {
        name: 'Stats Test Workspace',
      });

      const workspaceId = workspaceResponse.body.id;

      // Create multiple usage records for the workspace
      const usageRecords = [
        { operation: 'AI_COMPLETION', creditsUsed: 2.0 },
        { operation: 'AI_COMPLETION', creditsUsed: 1.5 },
        { operation: 'SQL_GENERATION', creditsUsed: 3.0 },
      ];

      for (const usage of usageRecords) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          ...usage,
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          workspaceId,
        });
      }

      // Get workspace credit statistics
      const statsResponse = await TestHelpers.authenticatedGet(`/credits/stats?workspaceId=${workspaceId}`, cookies);

      expect(statsResponse.body.totalCreditsUsed).toBe(6.5); // 2.0 + 1.5 + 3.0
      expect(statsResponse.body.usageByOperation.AI_COMPLETION).toBe(3.5);
      expect(statsResponse.body.usageByOperation.SQL_GENERATION).toBe(3.0);
    });
  });

  describe('Business Rule Enforcement', () => {
    it('should prevent personal workspace deletion', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get personal workspace
      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies);
      const personalWorkspace = workspacesResponse.body.data.find((w: any) => w.isPersonal);

      // Try to delete personal workspace
      const response = await TestHelpers.authenticatedDelete(`/workspaces/${personalWorkspace.id}`, cookies)
        .expect(400);

      expect(response.body.message).toContain('personal');
    });

    it('should prevent users from deleting themselves while being workspace owners', async () => {
      const { user, cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create team workspace (user becomes owner)
      await TestHelpers.authenticatedPost('/workspaces', cookies, {
        name: 'Owner Protection Test',
      });

      // Try to delete user account (should fail or transfer ownership first)
      const response = await TestHelpers.authenticatedDelete(`/users/${user.id}`, cookies)
        .expect(400);

      expect(response.body.message).toContain('workspace');
    });

    it('should enforce subscription plan workspace limits', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get FREE plan limits
      const limitsResponse = await TestHelpers.authenticatedGet('/subscriptions/limits', cookies);
      const maxWorkspaces = limitsResponse.body.workspaces;

      if (maxWorkspaces > 0 && maxWorkspaces < 10) {
        // Create workspaces up to the limit
        for (let i = 0; i < maxWorkspaces - 1; i++) { // -1 because personal workspace already exists
          await TestHelpers.authenticatedPost('/workspaces', cookies, {
            name: `Test Workspace ${i}`,
          })
          .expect(201);
        }

        // Try to create one more workspace (should fail)
        const response = await TestHelpers.authenticatedPost('/workspaces', cookies, {
          name: 'Over Limit Workspace',
        })
        .expect(402);

        expect(response.body.message).toContain('limit');
      }
    });

    it('should enforce team member limits based on subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, {
        name: 'Member Limit Test',
      });

      const workspaceId = workspaceResponse.body.id;

      // Get team member limits
      const limitsResponse = await TestHelpers.authenticatedGet('/subscriptions/limits', cookies);
      const maxMembers = limitsResponse.body.teamMembers;

      if (maxMembers > 0 && maxMembers < 10) {
        // Add members up to the limit
        const members = await TestHelpers.createMultipleAuthenticatedUsers(maxMembers);

        for (let i = 0; i < maxMembers; i++) {
          await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, cookies, {
            userId: members[i].user.id,
            role: 'MEMBER',
          })
          .expect(201);
        }

        // Try to add one more member (should fail)
        const extraMember = await TestHelpers.createAuthenticatedUser({
          email: TestHelpers.generateUniqueEmail(),
          password: 'TestPassword123!',
        });

        const response = await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, cookies, {
          userId: extraMember.user.id,
          role: 'MEMBER',
        })
        .expect(402);

        expect(response.body.message).toContain('limit');
      }
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain referential integrity across all entities', async () => {
      // Create a complete user scenario
      const scenario = await IntegratedFixtures.createCompleteUserScenario({
        user: {
          email: TestHelpers.generateUniqueEmail(),
          password: 'TestPassword123!',
          name: 'Integrity Test User',
        },
        workspaceCount: 2,
        creditUsageCount: 5,
      });

      const { cookies } = await TestHelpers.createAuthenticatedUser(scenario.user);

      // Verify all relationships exist
      const userResponse = await TestHelpers.authenticatedGet('/auth/me', cookies);
      expect(userResponse.body).toHaveProperty('id');

      const subscriptionResponse = await TestHelpers.authenticatedGet('/subscriptions', cookies);
      expect(subscriptionResponse.body.userId).toBe(userResponse.body.id);

      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies);
      expect(workspacesResponse.body.data.length).toBeGreaterThanOrEqual(1);

      const creditsResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      expect(creditsResponse.body).toHaveProperty('creditsRemaining');
    });

    it('should handle concurrent operations safely', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Make multiple concurrent credit usage requests
      const concurrentUsage = Array(5).fill(null).map(() =>
        TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.0,
        })
      );

      const responses = await Promise.all(concurrentUsage);

      // All should succeed or fail gracefully
      responses.forEach(response => {
        expect([201, 402]).toContain(response.status); // Created or insufficient credits
      });

      // Verify total credits used is accurate
      const creditsResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const usageResponse = await TestHelpers.authenticatedGet('/credits/usage', cookies);

      const totalUsed = usageResponse.body.data.reduce((sum: number, usage: any) => sum + usage.creditsUsed, 0);
      const successfulRequests = responses.filter(r => r.status === 201).length;

      expect(totalUsed).toBe(successfulRequests * 1.0);
    });

    it('should handle transaction rollbacks on failure', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get initial state
      const initialCredits = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const initialWorkspaces = await TestHelpers.authenticatedGet('/workspaces', cookies);

      // Try to create a workspace with invalid data that should cause rollback
      const invalidWorkspace = {
        name: '', // Invalid - empty name
        description: 'This should fail and rollback',
      };

      await TestHelpers.authenticatedPost('/workspaces', cookies, invalidWorkspace)
        .expect(400);

      // Verify state hasn't changed
      const finalCredits = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const finalWorkspaces = await TestHelpers.authenticatedGet('/workspaces', cookies);

      expect(finalCredits.body.creditsRemaining).toBe(initialCredits.body.creditsRemaining);
      expect(finalWorkspaces.body.data.length).toBe(initialWorkspaces.body.data.length);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk operations efficiently', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const startTime = Date.now();

      // Create multiple usage records
      const bulkUsage = Array(50).fill(null).map((_, i) => ({
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100 + i,
        outputTokens: 50 + i,
        creditsUsed: 1.0 + (i * 0.1),
      }));

      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < bulkUsage.length; i += batchSize) {
        const batch = bulkUsage.slice(i, i + batchSize);
        const batchPromises = batch.map(usage =>
          TestHelpers.authenticatedPost('/credits/usage', cookies, usage)
        );
        await Promise.all(batchPromises);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(30000); // 30 seconds

      // Verify all records were created
      const usageResponse = await TestHelpers.authenticatedGet('/credits/usage?limit=100', cookies);
      expect(usageResponse.body.data.length).toBeGreaterThanOrEqual(50);
    });

    it('should paginate large datasets efficiently', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create many usage records
      for (let i = 0; i < 25; i++) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.0,
        });
      }

      // Test pagination performance
      const page1Response = await TestHelpers.authenticatedGet('/credits/usage?limit=10&page=1', cookies);
      const page2Response = await TestHelpers.authenticatedGet('/credits/usage?limit=10&page=2', cookies);
      const page3Response = await TestHelpers.authenticatedGet('/credits/usage?limit=10&page=3', cookies);

      expect(page1Response.body.data).toHaveLength(10);
      expect(page2Response.body.data).toHaveLength(10);
      expect(page3Response.body.data.length).toBeGreaterThan(0);

      // Verify pagination metadata
      expect(page1Response.body.meta.page).toBe(1);
      expect(page2Response.body.meta.page).toBe(2);
      expect(page1Response.body.meta.total).toBeGreaterThanOrEqual(25);
    });
  });
});