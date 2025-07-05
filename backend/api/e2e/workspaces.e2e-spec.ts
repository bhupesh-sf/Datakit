import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';
import { UserFixture, WorkspaceFixture } from './fixtures/user.fixture';
import { Workspace } from '../src/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../src/workspaces/entities/workspace-member.entity';

describe('Workspaces (e2e)', () => {
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

  describe('GET /api/workspaces', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return user workspaces', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/workspaces', accessToken)
        .expect(200);

      expect(response.body).toHaveProperty('workspaces');
      expect(Array.isArray(response.body.workspaces)).toBe(true);
      
      // User should have a personal workspace created during signup
      expect(response.body.workspaces.length).toBeGreaterThan(0);
      
      const personalWorkspace = response.body.workspaces.find(w => w.isPersonal === true);
      expect(personalWorkspace).toBeDefined();
      expect(personalWorkspace.ownerId).toBe(user.id);
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('get', '/workspaces')
        .expect(401);
    });
  });

  describe('GET /api/workspaces/current', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return current workspace', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/workspaces/current', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        ownerId: user.id,
        isPersonal: true,
        members: expect.any(Array),
      });

      // Owner should be in members list
      const ownerMember = response.body.members.find(m => m.userId === user.id);
      expect(ownerMember).toBeDefined();
      expect(ownerMember.role).toBe('owner');
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('get', '/workspaces/current')
        .expect(401);
    });
  });

  describe('POST /api/workspaces', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should create new team workspace', async () => {
      const workspaceData = {
        name: 'Test Team Workspace',
        description: 'A workspace for testing',
        isPersonal: false,
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test Team Workspace',
        description: 'A workspace for testing',
        ownerId: user.id,
        isPersonal: false,
      });

      // Verify in database
      const workspaceRepo = DatabaseUtils.getRepository(app, Workspace);
      const workspace = await workspaceRepo.findOne({ 
        where: { id: response.body.id } 
      });
      expect(workspace).toBeDefined();
      expect(workspace?.name).toBe('Test Team Workspace');
    });

    it('should reject creation of personal workspace', async () => {
      const workspaceData = {
        name: 'Another Personal Workspace',
        isPersonal: true,
      };

      await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(400); // Users should only have one personal workspace
    });

    it('should validate workspace name', async () => {
      const workspaceData = {
        name: '', // Empty name
        isPersonal: false,
      };

      await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      const workspaceData = {
        name: 'Test Workspace',
        isPersonal: false,
      };

      await httpUtils
        .request('post', '/workspaces')
        .send(workspaceData)
        .expect(401);
    });
  });

  describe('PUT /api/workspaces/:id', () => {
    let accessToken: string;
    let user: any;
    let workspace: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;

      // Create a team workspace
      const workspaceData = {
        name: 'Original Workspace',
        description: 'Original description',
        isPersonal: false,
      };

      const createResponse = await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(201);

      workspace = createResponse.body;
    });

    it('should update workspace details', async () => {
      const updateData = {
        name: 'Updated Workspace Name',
        description: 'Updated description',
      };

      const response = await httpUtils
        .authenticatedRequest('put', `/workspaces/${workspace.id}`, accessToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: workspace.id,
        name: 'Updated Workspace Name',
        description: 'Updated description',
        ownerId: user.id,
      });
    });

    it('should reject update by non-owner', async () => {
      // Create another user
      const otherUserResult = await httpUtils.signup(UserFixture.createUserData());

      const updateData = { name: 'Unauthorized Update' };

      await httpUtils
        .authenticatedRequest('put', `/workspaces/${workspace.id}`, otherUserResult.accessToken)
        .send(updateData)
        .expect(403); // Forbidden
    });

    it('should reject update of non-existent workspace', async () => {
      const updateData = { name: 'Updated Name' };

      await httpUtils
        .authenticatedRequest('put', '/workspaces/non-existent-id', accessToken)
        .send(updateData)
        .expect(404);
    });

    it('should reject request without authentication', async () => {
      const updateData = { name: 'Updated Name' };

      await httpUtils
        .request('put', `/workspaces/${workspace.id}`)
        .send(updateData)
        .expect(401);
    });
  });

  describe('POST /api/workspaces/:id/members', () => {
    let accessToken: string;
    let user: any;
    let workspace: any;
    let otherUser: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;

      // Create another user to invite
      const otherUserResult = await httpUtils.signup(UserFixture.createUserData());
      otherUser = otherUserResult.user;

      // Create a team workspace
      const workspaceData = {
        name: 'Team Workspace',
        isPersonal: false,
      };

      const createResponse = await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(201);

      workspace = createResponse.body;
    });

    it('should invite member to workspace', async () => {
      const inviteData = {
        email: otherUser.email,
        role: 'member',
      };

      const response = await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(201);

      expect(response.body).toMatchObject({
        userId: otherUser.id,
        workspaceId: workspace.id,
        role: 'member',
        status: 'pending',
      });

      // Verify in database
      const memberRepo = DatabaseUtils.getRepository(app, WorkspaceMember);
      const member = await memberRepo.findOne({ 
        where: { 
          userId: otherUser.id, 
          workspaceId: workspace.id 
        } 
      });
      expect(member).toBeDefined();
    });

    it('should reject invitation to personal workspace', async () => {
      // Get user's personal workspace
      const workspacesResponse = await httpUtils
        .authenticatedRequest('get', '/workspaces', accessToken)
        .expect(200);

      const personalWorkspace = workspacesResponse.body.workspaces.find(w => w.isPersonal);

      const inviteData = {
        email: otherUser.email,
        role: 'member',
      };

      await httpUtils
        .authenticatedRequest('post', `/workspaces/${personalWorkspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(400);
    });

    it('should reject invitation by non-owner', async () => {
      const otherUserResult = await httpUtils.signup(UserFixture.createUserData());

      const inviteData = {
        email: 'someone@example.com',
        role: 'member',
      };

      await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, otherUserResult.accessToken)
        .send(inviteData)
        .expect(403);
    });

    it('should validate member role', async () => {
      const inviteData = {
        email: otherUser.email,
        role: 'invalid_role',
      };

      await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(400);
    });

    it('should reject duplicate invitations', async () => {
      const inviteData = {
        email: otherUser.email,
        role: 'member',
      };

      // First invitation
      await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(201);

      // Duplicate invitation
      await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(409); // Conflict
    });
  });

  describe('DELETE /api/workspaces/:id/members/:userId', () => {
    let accessToken: string;
    let user: any;
    let workspace: any;
    let memberUser: any;
    let memberAccessToken: string;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;

      // Create member user
      const memberResult = await httpUtils.signup(UserFixture.createUserData());
      memberUser = memberResult.user;
      memberAccessToken = memberResult.accessToken;

      // Create workspace
      const workspaceData = {
        name: 'Team Workspace',
        isPersonal: false,
      };

      const createResponse = await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(201);

      workspace = createResponse.body;

      // Add member
      const inviteData = {
        email: memberUser.email,
        role: 'member',
      };

      await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(201);
    });

    it('should remove member from workspace', async () => {
      const response = await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}/members/${memberUser.id}`, accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('removed'),
      });

      // Verify member is removed from database
      const memberRepo = DatabaseUtils.getRepository(app, WorkspaceMember);
      const member = await memberRepo.findOne({ 
        where: { 
          userId: memberUser.id, 
          workspaceId: workspace.id 
        } 
      });
      expect(member).toBeNull();
    });

    it('should allow member to leave workspace', async () => {
      await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}/members/${memberUser.id}`, memberAccessToken)
        .expect(200);
    });

    it('should reject removal by non-owner/non-member', async () => {
      const otherUserResult = await httpUtils.signup(UserFixture.createUserData());

      await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}/members/${memberUser.id}`, otherUserResult.accessToken)
        .expect(403);
    });

    it('should reject owner leaving workspace', async () => {
      await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}/members/${user.id}`, accessToken)
        .expect(400); // Owner cannot leave, must transfer ownership or delete workspace
    });
  });

  describe('DELETE /api/workspaces/:id', () => {
    let accessToken: string;
    let user: any;
    let workspace: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;

      // Create a team workspace
      const workspaceData = {
        name: 'Team Workspace',
        isPersonal: false,
      };

      const createResponse = await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(201);

      workspace = createResponse.body;
    });

    it('should delete workspace', async () => {
      const response = await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}`, accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('deleted'),
      });

      // Verify workspace is deleted from database
      const workspaceRepo = DatabaseUtils.getRepository(app, Workspace);
      const deletedWorkspace = await workspaceRepo.findOne({ 
        where: { id: workspace.id } 
      });
      expect(deletedWorkspace).toBeNull();
    });

    it('should reject deletion of personal workspace', async () => {
      // Get user's personal workspace
      const workspacesResponse = await httpUtils
        .authenticatedRequest('get', '/workspaces', accessToken)
        .expect(200);

      const personalWorkspace = workspacesResponse.body.workspaces.find(w => w.isPersonal);

      await httpUtils
        .authenticatedRequest('delete', `/workspaces/${personalWorkspace.id}`, accessToken)
        .expect(400);
    });

    it('should reject deletion by non-owner', async () => {
      const otherUserResult = await httpUtils.signup(UserFixture.createUserData());

      await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}`, otherUserResult.accessToken)
        .expect(403);
    });

    it('should cascade delete workspace members', async () => {
      // Add a member
      const memberResult = await httpUtils.signup(UserFixture.createUserData());
      
      const inviteData = {
        email: memberResult.user.email,
        role: 'member',
      };

      await httpUtils
        .authenticatedRequest('post', `/workspaces/${workspace.id}/members`, accessToken)
        .send(inviteData)
        .expect(201);

      // Delete workspace
      await httpUtils
        .authenticatedRequest('delete', `/workspaces/${workspace.id}`, accessToken)
        .expect(200);

      // Verify members are also deleted
      const memberRepo = DatabaseUtils.getRepository(app, WorkspaceMember);
      const members = await memberRepo.find({ 
        where: { workspaceId: workspace.id } 
      });
      expect(members).toHaveLength(0);
    });
  });

  describe('POST /api/workspaces/:id/switch', () => {
    let accessToken: string;
    let user: any;
    let teamWorkspace: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;

      // Create a team workspace
      const workspaceData = {
        name: 'Team Workspace',
        isPersonal: false,
      };

      const createResponse = await httpUtils
        .authenticatedRequest('post', '/workspaces', accessToken)
        .send(workspaceData)
        .expect(201);

      teamWorkspace = createResponse.body;
    });

    it('should switch to different workspace', async () => {
      const response = await httpUtils
        .authenticatedRequest('post', `/workspaces/${teamWorkspace.id}/switch`, accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('switched'),
        currentWorkspace: expect.objectContaining({
          id: teamWorkspace.id,
          name: teamWorkspace.name,
        }),
      });

      // Verify current workspace is updated
      const currentResponse = await httpUtils
        .authenticatedRequest('get', '/workspaces/current', accessToken)
        .expect(200);

      expect(currentResponse.body.id).toBe(teamWorkspace.id);
    });

    it('should reject switch to workspace user is not member of', async () => {
      const otherUserResult = await httpUtils.signup(UserFixture.createUserData());

      await httpUtils
        .authenticatedRequest('post', `/workspaces/${teamWorkspace.id}/switch`, otherUserResult.accessToken)
        .expect(403);
    });

    it('should reject switch to non-existent workspace', async () => {
      await httpUtils
        .authenticatedRequest('post', '/workspaces/non-existent-id/switch', accessToken)
        .expect(404);
    });
  });
});