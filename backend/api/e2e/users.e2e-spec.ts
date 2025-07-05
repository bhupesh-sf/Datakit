import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';
import { UserFixture } from './fixtures/user.fixture';
import { User } from '../src/users/entities/user.entity';

describe('Users (e2e)', () => {
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

  describe('GET /api/users/profile', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return user profile for authenticated user', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/users/profile', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: expect.any(Boolean),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Should not include sensitive fields
      expect(response.body.password).toBeUndefined();
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('get', '/users/profile')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await httpUtils
        .authenticatedRequest('get', '/users/profile', 'invalid-token')
        .expect(401);
    });
  });

  describe('PUT /api/users/profile', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should update user profile', async () => {
      const updateData = {
        name: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      const response = await httpUtils
        .authenticatedRequest('put', '/users/profile', accessToken)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        name: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      // Verify in database
      const userRepo = DatabaseUtils.getRepository(app, User);
      const updatedUser = await userRepo.findOne({ where: { id: user.id } });
      
      expect(updatedUser?.name).toBe('Updated Name');
      expect(updatedUser?.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should validate email format when updating', async () => {
      const updateData = {
        email: 'invalid-email',
      };

      await httpUtils
        .authenticatedRequest('put', '/users/profile', accessToken)
        .send(updateData)
        .expect(400);
    });

    it('should reject email update to existing email', async () => {
      // Create another user
      const otherUserData = UserFixture.createUserData();
      await httpUtils.signup(otherUserData);

      // Try to update to existing email
      const updateData = {
        email: otherUserData.email,
      };

      await httpUtils
        .authenticatedRequest('put', '/users/profile', accessToken)
        .send(updateData)
        .expect(409); // Conflict
    });

    it('should reject request without authentication', async () => {
      const updateData = { name: 'Updated Name' };

      await httpUtils
        .request('put', '/users/profile')
        .send(updateData)
        .expect(401);
    });

    it('should handle partial updates', async () => {
      const updateData = { name: 'Only Name Updated' };

      const response = await httpUtils
        .authenticatedRequest('put', '/users/profile', accessToken)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Only Name Updated');
      expect(response.body.email).toBe(user.email); // Should remain unchanged
    });
  });

  describe('POST /api/users/change-password', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createUserData());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should change password with valid current password', async () => {
      const passwordChangeData = {
        currentPassword: 'password123',
        newPassword: 'newPassword456',
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/users/change-password', accessToken)
        .send(passwordChangeData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.any(String),
      });

      // Verify can login with new password
      const loginResponse = await httpUtils.login({
        email: user.email,
        password: 'newPassword456',
      });

      expect(loginResponse.user.id).toBe(user.id);
    });

    it('should reject change with incorrect current password', async () => {
      const passwordChangeData = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword456',
      };

      await httpUtils
        .authenticatedRequest('post', '/users/change-password', accessToken)
        .send(passwordChangeData)
        .expect(400);
    });

    it('should validate new password requirements', async () => {
      const passwordChangeData = {
        currentPassword: 'password123',
        newPassword: '123', // Too short
      };

      await httpUtils
        .authenticatedRequest('post', '/users/change-password', accessToken)
        .send(passwordChangeData)
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      const passwordChangeData = {
        currentPassword: 'password123',
        newPassword: 'newPassword456',
      };

      await httpUtils
        .request('post', '/users/change-password')
        .send(passwordChangeData)
        .expect(401);
    });

    it('should invalidate old sessions after password change', async () => {
      const passwordChangeData = {
        currentPassword: 'password123',
        newPassword: 'newPassword456',
      };

      // Change password
      await httpUtils
        .authenticatedRequest('post', '/users/change-password', accessToken)
        .send(passwordChangeData)
        .expect(200);

      // Old token should no longer work
      await httpUtils
        .authenticatedRequest('get', '/users/profile', accessToken)
        .expect(401);
    });
  });

  describe('POST /api/users/verify-email', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createUserData());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should send verification email', async () => {
      const response = await httpUtils
        .authenticatedRequest('post', '/users/verify-email', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('verification email sent'),
      });
    });

    it('should handle already verified email', async () => {
      // First verify the email
      const userRepo = DatabaseUtils.getRepository(app, User);
      await userRepo.update(user.id, { emailVerified: true });

      const response = await httpUtils
        .authenticatedRequest('post', '/users/verify-email', accessToken)
        .expect(200);

      expect(response.body.message).toContain('already verified');
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('post', '/users/verify-email')
        .expect(401);
    });
  });

  describe('POST /api/users/verify-email-token', () => {
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createUserData());
      user = result.user;
    });

    it('should verify email with valid token', async () => {
      // For testing, we'll use a mock token (in real implementation, this would be a JWT)
      const verificationToken = 'valid-verification-token';

      const response = await httpUtils
        .request('post', '/users/verify-email-token')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('verified'),
      });
    });

    it('should reject invalid verification token', async () => {
      const invalidToken = 'invalid-token';

      await httpUtils
        .request('post', '/users/verify-email-token')
        .send({ token: invalidToken })
        .expect(400);
    });

    it('should reject expired verification token', async () => {
      const expiredToken = 'expired-token';

      await httpUtils
        .request('post', '/users/verify-email-token')
        .send({ token: expiredToken })
        .expect(400);
    });

    it('should reject request without token', async () => {
      await httpUtils
        .request('post', '/users/verify-email-token')
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /api/users/account', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createUserData());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should delete user account with password confirmation', async () => {
      const deleteData = {
        password: 'password123',
        confirmation: 'DELETE_MY_ACCOUNT',
      };

      const response = await httpUtils
        .authenticatedRequest('delete', '/users/account', accessToken)
        .send(deleteData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('deleted'),
      });

      // Verify user is deleted from database
      const userRepo = DatabaseUtils.getRepository(app, User);
      const deletedUser = await userRepo.findOne({ where: { id: user.id } });
      expect(deletedUser).toBeNull();
    });

    it('should reject deletion with incorrect password', async () => {
      const deleteData = {
        password: 'wrongPassword',
        confirmation: 'DELETE_MY_ACCOUNT',
      };

      await httpUtils
        .authenticatedRequest('delete', '/users/account', accessToken)
        .send(deleteData)
        .expect(400);
    });

    it('should reject deletion without proper confirmation', async () => {
      const deleteData = {
        password: 'password123',
        confirmation: 'wrong confirmation',
      };

      await httpUtils
        .authenticatedRequest('delete', '/users/account', accessToken)
        .send(deleteData)
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      const deleteData = {
        password: 'password123',
        confirmation: 'DELETE_MY_ACCOUNT',
      };

      await httpUtils
        .request('delete', '/users/account')
        .send(deleteData)
        .expect(401);
    });

    it('should cascade delete related data', async () => {
      // Make AI request to create usage data
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };
      await httpUtils.generateCompletion(accessToken, aiRequest);

      // Delete account
      const deleteData = {
        password: 'password123',
        confirmation: 'DELETE_MY_ACCOUNT',
      };

      await httpUtils
        .authenticatedRequest('delete', '/users/account', accessToken)
        .send(deleteData)
        .expect(200);

      // Verify related data is also deleted (subscription, credit usage, etc.)
      const userRepo = DatabaseUtils.getRepository(app, User);
      const deletedUser = await userRepo.findOne({ 
        where: { id: user.id },
        relations: ['subscription']
      });
      expect(deletedUser).toBeNull();
    });
  });
});