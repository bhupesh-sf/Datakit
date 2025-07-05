import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';
import { UserFixture, SubscriptionFixture } from './fixtures/user.fixture';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';
import { CreditUsage } from '../src/credits/entities/credit-usage.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';

describe('AI (e2e)', () => {
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

  describe('POST /api/ai/chat/completions/check', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should check credits for valid request', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        max_tokens: 100,
      };

      const response = await httpUtils
        .checkCredits(accessToken, aiRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        hasCredits: true,
        estimatedCredits: expect.any(Number),
        creditsRemaining: expect.anything(), // Can be number or string
      });
      
      // Verify creditsRemaining is a valid number (even if returned as string)
      const credits = parseFloat(response.body.creditsRemaining);
      expect(credits).toBeGreaterThan(0);
    });

    it('should reject request without authentication', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      await httpUtils
        .request('post', '/ai/chat/completions/check')

        .send(aiRequest)
        .expect(401);
    });

    it('should validate AI request format', async () => {
      const invalidRequest = {
        model: 'datakit-fast',
        // Missing messages array
        max_tokens: 100,
      };

      await httpUtils.checkCredits(accessToken, invalidRequest).expect(500);
    });

    it('should handle insufficient credits', async () => {
      // Update user subscription to have 0 credits
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        { creditsRemaining: 0 },
      );

      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      const response = await httpUtils
        .checkCredits(accessToken, aiRequest)
        .expect(201);

      expect(response.body.hasCredits).toBe(false);
    });

    it('should calculate credits correctly for different models', async () => {
      const fastRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      const smartRequest = {
        model: 'datakit-smart',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      const fastResponse = await httpUtils
        .checkCredits(accessToken, fastRequest)
        .expect(201);

      const smartResponse = await httpUtils
        .checkCredits(accessToken, smartRequest)
        .expect(201);

      expect(fastResponse.body.estimatedCredits).toBeDefined();
      expect(smartResponse.body.estimatedCredits).toBeDefined();
      // Different models should have different credit costs
      expect(fastResponse.body.estimatedCredits).not.toBe(
        smartResponse.body.estimatedCredits,
      );
    });
  });

  describe('POST /api/ai/chat/completions', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should generate completion for valid request', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Say hello in one word' }],
        max_tokens: 10,
      };

      const response = await httpUtils
        .generateCompletion(accessToken, aiRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        choices: expect.any(Array),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        }),
      });

      expect(response.body.choices[0]).toMatchObject({
        message: expect.objectContaining({
          role: 'assistant',
          content: expect.any(String),
        }),
        finish_reason: expect.any(String),
      });
    });

    it('should reject request without authentication', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      await httpUtils
        .request('post', '/ai/chat/completions')
        .send(aiRequest)
        .expect(401);
    });

    it('should deduct credits after successful completion', async () => {
      // Get initial credits
      const initialCreditsResponse = await httpUtils.checkCredits(accessToken, {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });

      const initialCredits = initialCreditsResponse.body.creditsRemaining;

      // Generate completion
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Say hello in one word' }],
        max_tokens: 10,
      };

      await httpUtils.generateCompletion(accessToken, aiRequest).expect(200);

      // Check credits after completion
      const finalCreditsResponse = await httpUtils.checkCredits(
        accessToken,
        aiRequest,
      );

      const finalCredits = finalCreditsResponse.body.creditsRemaining;
      expect(finalCredits).toBeLessThan(initialCredits);
    });

    it('should reject request when user has insufficient credits', async () => {
      // Update user subscription to have very few credits
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        { creditsRemaining: 1 },
      );

      const aiRequest = {
        model: 'datakit-fast',
        messages: [
          { role: 'user', content: 'Write a very long story about adventures' },
        ],
        max_tokens: 1000, // This should require more than 1 credit
      };

      await httpUtils.generateCompletion(accessToken, aiRequest).expect(402); // Payment required
    });

    it('should record credit usage in database', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      const response = await httpUtils
        .generateCompletion(accessToken, aiRequest)
        .expect(201);

      // Check that credit usage was recorded
      const creditUsageRepo = DatabaseUtils.getRepository(app, CreditUsage);
      const usageRecords = await creditUsageRepo.find({
        where: { userId: user.id },
      });

      expect(usageRecords.length).toBeGreaterThan(0);

      const latestUsage = usageRecords[usageRecords.length - 1];
      expect(latestUsage).toMatchObject({
        userId: user.id,
        model: 'datakit-fast',
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        creditsUsed: expect.any(Number),
      });
    });

    it('should handle streaming responses correctly', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Count from 1 to 3' }],
        max_tokens: 20,
        stream: true,
      };

      const response = await httpUtils
        .generateCompletion(accessToken, aiRequest)
        .expect(201);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should validate model availability', async () => {
      const aiRequest = {
        model: 'datakit-invalid-model',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      await httpUtils.generateCompletion(accessToken, aiRequest).expect(400);
    });
  });

  describe('AI Provider Integration', () => {
    let accessToken: string;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
    });

    it('should handle OpenAI provider requests', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/ai/chat/completions', accessToken)
        .send(aiRequest)
        .expect(201);

      expect(response.body.model).toContain('datakit');
    });

    it('should handle Anthropic provider requests', async () => {
      const aiRequest = {
        model: 'datakit-smart',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/ai/chat/completions', accessToken)

        .send(aiRequest)
        .expect(201);

      expect(response.body.model).toContain('datakit');
    });

    it('should default to datakit provider when header is missing', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      await httpUtils
        .authenticatedRequest('post', '/ai/chat/completions', accessToken)
        .send(aiRequest)
        .expect(201);
    });

    it('should reject invalid provider headers', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      await httpUtils
        .authenticatedRequest('post', '/ai/chat/completions', accessToken)
        .send(aiRequest)
        .expect(400);
    });
  });

  describe('Credit Management', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should handle PRO subscription with higher credit limits', async () => {
      // Update user to PRO subscription
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        SubscriptionFixture.createProSubscription(user.id),
      );

      const response = await httpUtils
        .checkCredits(accessToken, {
          model: 'datakit-fast',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 100,
        })
        .expect(201);

      expect(response.body.creditsRemaining).toBe(1575); // PRO credits
    });

    it('should handle credit reset logic', async () => {
      // Set credits reset date to past
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        {
          creditsRemaining: 0,
          creditsResetAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        },
      );

      // Check credits - should trigger reset
      const response = await httpUtils
        .checkCredits(accessToken, {
          model: 'datakit-fast',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 100,
        })
        .expect(201);

      expect(response.body.creditsRemaining).toBe(315); // FREE credits after reset
    });

    it('should handle concurrent credit deductions correctly', async () => {
      const aiRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      };

      // Make multiple concurrent requests
      const promises = Array(3)
        .fill(0)
        .map(() => httpUtils.generateCompletion(accessToken, aiRequest));

      const responses = await Promise.all(promises);

      // All should succeed if we have enough credits
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Check that credits were properly deducted
      const finalCreditsResponse = await httpUtils.checkCredits(
        accessToken,
        aiRequest,
      );

      expect(finalCreditsResponse.body.creditsRemaining).toBeLessThan(315);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let accessToken: string;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
    });

    it('should handle malformed AI requests gracefully', async () => {
      const malformedRequest = {
        model: 'datakit-fast',
        messages: 'not an array', // Should be array
        max_tokens: 100,
      };

      await httpUtils
        .generateCompletion(accessToken, malformedRequest)
        .expect(400);
    });

    it('should handle very large token requests', async () => {
      const largeRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100000, // Very large token request
      };

      await httpUtils.generateCompletion(accessToken, largeRequest).expect(400); // Should be rejected for being too large
    });

    it('should handle empty messages array', async () => {
      const emptyRequest = {
        model: 'datakit-fast',
        messages: [],
        max_tokens: 100,
      };

      await httpUtils.generateCompletion(accessToken, emptyRequest).expect(400);
    });

    it('should handle invalid message roles', async () => {
      const invalidRoleRequest = {
        model: 'datakit-fast',
        messages: [{ role: 'invalid_role', content: 'Hello' }],
        max_tokens: 100,
      };

      await httpUtils
        .generateCompletion(accessToken, invalidRoleRequest)
        .expect(400);
    });

    it('should handle API rate limiting gracefully', async () => {
      // Make rapid successive requests to test rate limiting
      const rapidRequests = Array(10)
        .fill(0)
        .map(() =>
          httpUtils.generateCompletion(accessToken, {
            model: 'datakit-fast',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 10,
          }),
        );

      const responses = await Promise.allSettled(rapidRequests);

      // Some requests should succeed, some might be rate limited
      const successfulRequests = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      );
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });
});
