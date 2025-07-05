import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';
import { UserFixture, SubscriptionFixture } from './fixtures/user.fixture';
import { AIFixture } from './fixtures/ai.fixture';
import { CreditUsage } from '../src/credits/entities/credit-usage.entity';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';

describe('Credits (e2e)', () => {
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

  describe('POST /api/credits/estimate', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should estimate credits for AI request', async () => {
      const estimateRequest = {
        modelId: 'datakit-fast',
        inputTokens: 100,
        outputTokens: 50,
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/credits/estimate', accessToken)
        .send(estimateRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        estimatedCredits: expect.any(Number),
      });

      expect(response.body.estimatedCredits).toBeGreaterThan(0);
    });

    it('should handle different models with different pricing', async () => {
      const fastRequest = {
        modelId: 'datakit-fast',
        inputTokens: 100,
        outputTokens: 50,
      };
      
      const smartRequest = {
        modelId: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
      };

      const fastResponse = await httpUtils
        .authenticatedRequest('post', '/credits/estimate', accessToken)
        .send(fastRequest)
        .expect(201);

      const smartResponse = await httpUtils
        .authenticatedRequest('post', '/credits/estimate', accessToken)
        .send(smartRequest)
        .expect(201);

      // Smart should be more expensive than fast
      expect(smartResponse.body.estimatedCredits).toBeGreaterThan(
        fastResponse.body.estimatedCredits
      );
    });

    it('should estimate higher costs for longer messages', async () => {
      const shortRequest = {
        modelId: 'datakit-fast',
        inputTokens: 50,
        outputTokens: 25,
      };
      
      const longRequest = {
        modelId: 'datakit-fast',
        inputTokens: 500,
        outputTokens: 250,
      };

      const shortResponse = await httpUtils
        .authenticatedRequest('post', '/credits/estimate', accessToken)
        .send(shortRequest)
        .expect(201);

      const longResponse = await httpUtils
        .authenticatedRequest('post', '/credits/estimate', accessToken)
        .send(longRequest)
        .expect(201);

      expect(longResponse.body.estimatedCredits).toBeGreaterThan(
        shortResponse.body.estimatedCredits
      );
    });

    it('should reject request without authentication', async () => {
      const estimateRequest = {
        modelId: 'datakit-fast',
        inputTokens: 100,
        outputTokens: 50,
      };

      await httpUtils
        .request('post', '/credits/estimate')
        .send(estimateRequest)
        .expect(401);
    });

    it('should validate request format', async () => {
      const invalidRequest = {
        modelId: 'datakit-fast',
        // Missing inputTokens and outputTokens
      };

      await httpUtils
        .authenticatedRequest('post', '/credits/estimate', accessToken)
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('GET /api/credits/usage', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return empty usage for new user', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/credits/usage', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        usages: [],
        total: 0,
        limit: expect.any(Number),
        offset: expect.any(Number),
      });
    });

    it('should return usage history after AI requests', async () => {
      // First make an AI request to generate usage
      const aiRequest = AIFixture.createBasicAIRequest();
      await httpUtils.generateCompletion(accessToken, aiRequest).expect(200);

      // Then check usage
      const response = await httpUtils
        .authenticatedRequest('get', '/credits/usage', accessToken)
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.usages.length).toBeGreaterThan(0);
      
      const latestUsage = response.body.usages[0];
      expect(latestUsage).toMatchObject({
        model: 'datakit-fast',
        creditsUsed: expect.any(Number),
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        createdAt: expect.any(String),
      });
    });

    it('should filter usage by date range', async () => {
      // Make AI request
      await httpUtils.generateCompletion(
        accessToken, 
        AIFixture.createBasicAIRequest()
      ).expect(200);

      // Query with date filter (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const response = await httpUtils
        .authenticatedRequest('get', '/credits/usage', accessToken)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(200);

      expect(response.body.usages.length).toBeGreaterThan(0);
    });

    it('should paginate usage history', async () => {
      // Make multiple AI requests
      for (let i = 0; i < 3; i++) {
        await httpUtils.generateCompletion(
          accessToken,
          AIFixture.createBasicAIRequest()
        ).expect(200);
      }

      // Query with limit
      const response = await httpUtils
        .authenticatedRequest('get', '/credits/usage', accessToken)
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.usages.length).toBeLessThanOrEqual(2);
      expect(response.body.limit).toBe(2);
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('get', '/credits/usage')
        .expect(401);
    });
  });

  describe('Credit Tracking Integration', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should accurately track credits across multiple requests', async () => {
      // Get initial credits
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      const initialSubscription = await subscriptionRepo.findOne({ 
        where: { userId: user.id } 
      });
      const initialCredits = Number(initialSubscription?.creditsRemaining || 0);

      // Make multiple AI requests
      const requests = [
        AIFixture.createBasicAIRequest({ model: 'datakit-fast' }),
        AIFixture.createBasicAIRequest({ model: 'datakit-smart' }),
      ];

      let totalExpectedCost = 0;
      
      for (const request of requests) {
        // Estimate cost using correct API format
        const estimateRequest = {
          modelId: request.model,
          inputTokens: AIFixture.estimateTokens(request.messages),
          outputTokens: request.max_tokens || 100,
        };
        
        const estimateResponse = await httpUtils
          .authenticatedRequest('post', '/credits/estimate', accessToken)
          .send(estimateRequest)
          .expect(201);
        
        totalExpectedCost += estimateResponse.body.estimatedCredits;

        // Make actual request
        await httpUtils.generateCompletion(accessToken, request).expect(200);
      }

      // Check final credits
      const finalSubscription = await subscriptionRepo.findOne({ 
        where: { userId: user.id } 
      });
      const finalCredits = Number(finalSubscription?.creditsRemaining || 0);

      // Credits should be reduced by approximately the estimated cost
      const actualCost = initialCredits - finalCredits;
      expect(actualCost).toBeCloseTo(totalExpectedCost, 2);

      // Verify usage records were created
      const creditUsageRepo = DatabaseUtils.getRepository(app, CreditUsage);
      const usageRecords = await creditUsageRepo.find({ 
        where: { userId: user.id },
        order: { createdAt: 'DESC' }
      });

      expect(usageRecords).toHaveLength(requests.length);
    });

    it('should handle credit exhaustion correctly', async () => {
      // Set user to have very low credits
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        { creditsRemaining: 0.01 }
      );

      // Try to make expensive request
      const expensiveRequest = AIFixture.createExpensiveRequest();

      // Should fail with insufficient credits
      await httpUtils
        .generateCompletion(accessToken, expensiveRequest)
        .expect(402); // Payment required

      // Credits should remain unchanged
      const subscription = await subscriptionRepo.findOne({ 
        where: { userId: user.id } 
      });
      expect(Number(subscription?.creditsRemaining)).toBeLessThan(0.02);
    });

    it('should handle concurrent requests without race conditions', async () => {
      const requests = Array(3).fill(0).map(() => 
        httpUtils.generateCompletion(
          accessToken, 
          AIFixture.createBasicAIRequest()
        )
      );

      // All should succeed or all should fail consistently
      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);
      
      // All should have same status (either all 200 or all 402)
      expect(statusCodes.every(code => code === statusCodes[0])).toBe(true);
    });
  });
});