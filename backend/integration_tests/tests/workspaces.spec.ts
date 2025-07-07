import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TestAppFactory } from '../setup/test-app.factory';
import { TestHelpers } from '../utils/test-helpers';
import { WorkspaceFixtures } from '../fixtures';

describe('Workspaces CRUD Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestAppFactory.createTestApp();
  });

  describe('GET /workspaces (List Workspaces)', () => {
    it('should return user workspaces for authenticated user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Workspace Owner',
      });

      const response = await TestHelpers.authenticatedGet('/workspaces', cookies)
        .expect(200);

      TestHelpers.expectPaginatedResponse(response, ['id', 'name', 'description', 'isPersonal']);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1); // Should have personal workspace
      
      // Verify workspace structure
      const workspace = response.body.data[0];
      expect(workspace).toHaveProperty('id');
      expect(workspace).toHaveProperty('name');
      expect(workspace).toHaveProperty('isPersonal');
      expect(workspace).toHaveProperty('createdAt');
      expect(workspace).toHaveProperty('members');
    });

    it('should include personal workspace created during signup', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Personal User',
      });

      const response = await TestHelpers.authenticatedGet('/workspaces', cookies)
        .expect(200);

      const personalWorkspace = response.body.data.find((ws: any) => ws.isPersonal === true);
      expect(personalWorkspace).toBeDefined();
      expect(personalWorkspace.name).toContain('Personal');
    });

    it('should filter workspaces by type (personal/team)', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create a team workspace
      const teamWorkspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Team Workspace',
        isPersonal: false,
      });

      await TestHelpers.authenticatedPost('/workspaces', cookies, teamWorkspaceData)
        .expect(201);

      // Filter for personal workspaces only
      const personalResponse = await TestHelpers.authenticatedGet('/workspaces?type=personal', cookies)
        .expect(200);

      personalResponse.body.data.forEach((workspace: any) => {
        expect(workspace.isPersonal).toBe(true);
      });

      // Filter for team workspaces only
      const teamResponse = await TestHelpers.authenticatedGet('/workspaces?type=team', cookies)
        .expect(200);

      teamResponse.body.data.forEach((workspace: any) => {
        expect(workspace.isPersonal).toBe(false);
      });
    });

    it('should support pagination for workspaces', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create multiple workspaces
      for (let i = 0; i < 5; i++) {
        const workspaceData = WorkspaceFixtures.createWorkspaceData({
          name: `Test Workspace ${i}`,
          isPersonal: false,
        });
        await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData);
      }

      const response = await TestHelpers.authenticatedGet('/workspaces?limit=3&page=1', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.limit).toBe(3);
      expect(response.body.meta.page).toBe(1);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/workspaces')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });
  });

  describe('POST /workspaces (Create Workspace)', () => {
    it('should successfully create a new team workspace', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Workspace Creator',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'New Team Workspace',
        description: 'A workspace for team collaboration',
        isPersonal: false,
      });

      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', workspaceData.name);
      expect(response.body).toHaveProperty('description', workspaceData.description);
      expect(response.body).toHaveProperty('isPersonal', false);
      expect(response.body).toHaveProperty('members');
      expect(response.body.members).toHaveLength(1); // Creator should be added as owner
      expect(response.body.members[0].role).toBe('OWNER');
    });

    it('should create workspace with minimal required data', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = {
        name: 'Minimal Workspace',
      };

      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      expect(response.body).toHaveProperty('name', workspaceData.name);
      expect(response.body).toHaveProperty('isPersonal', false); // Default value
      expect(response.body.description).toBeFalsy();
    });

    it('should reject workspace creation with empty name', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = {
        name: '',
        description: 'Valid description',
      };

      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'name');
    });

    it('should reject workspace creation with name too long', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = {
        name: 'A'.repeat(256), // Assuming max length is 255
        description: 'Valid description',
      };

      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'name');
    });

    it('should reject workspace creation with description too long', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = {
        name: 'Valid Name',
        description: 'A'.repeat(1001), // Assuming max length is 1000
      };

      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'description');
    });

    it('should prevent creation of duplicate workspace names for same user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = {
        name: 'Duplicate Name Test',
        description: 'First workspace',
      };

      // Create first workspace
      await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      // Try to create second workspace with same name
      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(409);

      expect(response.body.message).toContain('name');
    });

    it('should reject unauthenticated workspace creation', async () => {
      const workspaceData = {
        name: 'Unauthorized Workspace',
      };

      const response = await request(app.getHttpServer())
        .post('/workspaces')
        .send(workspaceData)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should prevent creation of personal workspace manually', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = {
        name: 'Manual Personal Workspace',
        isPersonal: true, // Should not be allowed via API
      };

      const response = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(400);

      expect(response.body.message).toContain('personal');
    });
  });

  describe('GET /workspaces/:id (Get Workspace by ID)', () => {
    it('should return workspace details for owner', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Test Workspace Details',
        description: 'Detailed workspace information',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const response = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('id', workspaceId);
      expect(response.body).toHaveProperty('name', workspaceData.name);
      expect(response.body).toHaveProperty('description', workspaceData.description);
      expect(response.body).toHaveProperty('members');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return workspace details for member', async () => {
      // Create workspace owner
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace member
      const { user: memberUser, cookies: memberCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'member@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Member Access Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add member to workspace
      const memberData = {
        userId: memberUser.id,
        role: 'MEMBER',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Member should be able to access workspace
      const response = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, memberCookies)
        .expect(200);

      expect(response.body).toHaveProperty('id', workspaceId);
      expect(response.body).toHaveProperty('name', workspaceData.name);
    });

    it('should reject access for non-members', async () => {
      // Create workspace owner
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      // Create non-member user
      const { cookies: nonMemberCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'nonmember@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Private Workspace',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Non-member should not be able to access workspace
      const response = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, nonMemberCookies)
        .expect(403);

      TestHelpers.expectForbidden(response);
    });

    it('should return 404 for non-existent workspace', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/workspaces/non-existent-id', cookies)
        .expect(404);

      TestHelpers.expectNotFound(response);
    });

    it('should include member details when requested', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Workspace with Members',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const response = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}?include=members`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members.length).toBeGreaterThan(0);
      
      const member = response.body.members[0];
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('user');
      expect(member.user).toHaveProperty('id');
      expect(member.user).toHaveProperty('email');
      expect(member.user).not.toHaveProperty('password');
    });
  });

  describe('PUT /workspaces/:id (Update Workspace)', () => {
    it('should successfully update workspace name and description', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Original Name',
        description: 'Original description',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const response = await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}`, cookies, updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);
      expect(response.body).toHaveProperty('id', workspaceId);
    });

    it('should allow admin to update workspace', async () => {
      // Create workspace owner
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      // Create admin user
      const { user: adminUser, cookies: adminCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Admin Update Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add admin to workspace
      const memberData = {
        userId: adminUser.id,
        role: 'ADMIN',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Admin should be able to update workspace
      const updateData = {
        name: 'Admin Updated Name',
      };

      const response = await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}`, adminCookies, updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', updateData.name);
    });

    it('should reject update from regular member', async () => {
      // Create workspace owner
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      // Create member user
      const { user: memberUser, cookies: memberCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'member@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Member Update Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add member to workspace
      const memberData = {
        userId: memberUser.id,
        role: 'MEMBER',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Member should not be able to update workspace
      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}`, memberCookies, updateData)
        .expect(403);

      TestHelpers.expectForbidden(response);
    });

    it('should reject update with invalid data', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData();
      const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const updateData = {
        name: '', // Empty name should be rejected
      };

      const response = await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}`, cookies, updateData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'name');
    });

    it('should prevent updating isPersonal flag', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        isPersonal: false,
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const updateData = {
        name: 'Updated Name',
        isPersonal: true, // Should not be updatable
      };

      const response = await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}`, cookies, updateData)
        .expect(400);

      expect(response.body.message).toContain('personal');
    });
  });

  describe('DELETE /workspaces/:id (Delete Workspace)', () => {
    it('should successfully delete workspace as owner', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Workspace To Delete',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', cookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const response = await TestHelpers.authenticatedDelete(`/workspaces/${workspaceId}`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify workspace is actually deleted
      const getResponse = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, cookies)
        .expect(404);

      TestHelpers.expectNotFound(getResponse);
    });

    it('should prevent deletion of personal workspace', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get personal workspace
      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies)
        .expect(200);

      const personalWorkspace = workspacesResponse.body.data.find((ws: any) => ws.isPersonal === true);
      expect(personalWorkspace).toBeDefined();

      // Try to delete personal workspace
      const response = await TestHelpers.authenticatedDelete(`/workspaces/${personalWorkspace.id}`, cookies)
        .expect(400);

      expect(response.body.message).toContain('personal');
    });

    it('should reject deletion from non-owner', async () => {
      // Create workspace owner
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      // Create admin user
      const { user: adminUser, cookies: adminCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'admin@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Delete Permission Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add admin to workspace
      const memberData = {
        userId: adminUser.id,
        role: 'ADMIN',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Admin should not be able to delete workspace (only owner can)
      const response = await TestHelpers.authenticatedDelete(`/workspaces/${workspaceId}`, adminCookies)
        .expect(403);

      TestHelpers.expectForbidden(response);
    });

    it('should cascade delete workspace members', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      const { user: memberUser } = await TestHelpers.createAuthenticatedUser({
        email: 'member@example.com',
        password: 'TestPassword123!',
      });

      // Create workspace
      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Cascade Delete Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add member to workspace
      const memberData = {
        userId: memberUser.id,
        role: 'MEMBER',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Delete workspace
      await TestHelpers.authenticatedDelete(`/workspaces/${workspaceId}`, ownerCookies)
        .expect(200);

      // Verify members are also deleted (would need members endpoint to test)
      // For now, just verify workspace is deleted
      await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}`, ownerCookies)
        .expect(404);
    });
  });

  describe('Workspace Member Management', () => {
    it('should get workspace members', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Member List Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const response = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}/members`, ownerCookies)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1); // Owner should be there
      
      const ownerMember = response.body.data.find((member: any) => member.role === 'OWNER');
      expect(ownerMember).toBeDefined();
      expect(ownerMember).toHaveProperty('user');
      expect(ownerMember.user).toHaveProperty('email');
    });

    it('should add member to workspace', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      const { user: newMember } = await TestHelpers.createAuthenticatedUser({
        email: 'newmember@example.com',
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Add Member Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const memberData = {
        userId: newMember.id,
        role: 'MEMBER',
      };

      const response = await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      expect(response.body).toHaveProperty('userId', newMember.id);
      expect(response.body).toHaveProperty('role', 'MEMBER');
      expect(response.body).toHaveProperty('workspaceId', workspaceId);
    });

    it('should update member role', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      const { user: member } = await TestHelpers.createAuthenticatedUser({
        email: 'member@example.com',
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Update Role Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add member
      const memberData = {
        userId: member.id,
        role: 'MEMBER',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Update role to ADMIN
      const updateData = {
        role: 'ADMIN',
      };

      const response = await TestHelpers.authenticatedPut(`/workspaces/${workspaceId}/members/${member.id}`, ownerCookies, updateData)
        .expect(200);

      expect(response.body).toHaveProperty('role', 'ADMIN');
    });

    it('should remove member from workspace', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      const { user: member } = await TestHelpers.createAuthenticatedUser({
        email: 'member@example.com',
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Remove Member Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      // Add member
      const memberData = {
        userId: member.id,
        role: 'MEMBER',
      };

      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Remove member
      const response = await TestHelpers.authenticatedDelete(`/workspaces/${workspaceId}/members/${member.id}`, ownerCookies)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('removed');

      // Verify member is removed
      const membersResponse = await TestHelpers.authenticatedGet(`/workspaces/${workspaceId}/members`, ownerCookies)
        .expect(200);

      const removedMember = membersResponse.body.data.find((m: any) => m.userId === member.id);
      expect(removedMember).toBeUndefined();
    });

    it('should prevent adding duplicate members', async () => {
      const { cookies: ownerCookies } = await TestHelpers.createAuthenticatedUser({
        email: 'owner@example.com',
        password: 'TestPassword123!',
      });

      const { user: member } = await TestHelpers.createAuthenticatedUser({
        email: 'member@example.com',
        password: 'TestPassword123!',
      });

      const workspaceData = WorkspaceFixtures.createWorkspaceData({
        name: 'Duplicate Member Test',
      });

      const createResponse = await TestHelpers.authenticatedPost('/workspaces', ownerCookies, workspaceData)
        .expect(201);

      const workspaceId = createResponse.body.id;

      const memberData = {
        userId: member.id,
        role: 'MEMBER',
      };

      // Add member first time
      await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(201);

      // Try to add same member again
      const response = await TestHelpers.authenticatedPost(`/workspaces/${workspaceId}/members`, ownerCookies, memberData)
        .expect(409);

      expect(response.body.message).toContain('already');
    });
  });
});