import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TestAppFactory } from '../setup/test-app.factory';
import { TestHelpers } from '../utils/test-helpers';
import { CreditFixtures } from '../fixtures';

describe('Credits CRUD Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestAppFactory.createTestApp();
  });

  describe('GET /credits/remaining (Get Remaining Credits)', () => {
    it('should return remaining credits for authenticated user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Credit User',
      });

      const response = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('creditsRemaining');
      expect(response.body).toHaveProperty('creditsLimit');
      expect(response.body).toHaveProperty('resetDate');
      expect(response.body).toHaveProperty('planType');
      expect(typeof response.body.creditsRemaining).toBe('number');
      expect(typeof response.body.creditsLimit).toBe('number');
    });

    it('should return -1 for unlimited credits (ENTERPRISE plan)', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to ENTERPRISE plan (assuming it has unlimited credits)
      const enterpriseUpgrade = {
        planType: 'ENTERPRISE',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, enterpriseUpgrade)
        .expect(200);

      const response = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      expect(response.body.creditsRemaining).toBe(-1); // -1 indicates unlimited
      expect(response.body.creditsLimit).toBe(-1);
    });

    it('should return accurate count after credit usage', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get initial credits
      const initialResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      const initialCredits = initialResponse.body.creditsRemaining;

      // Use some credits through AI endpoint (mock usage)
      const usageData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      };

      await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(201);

      // Check updated credits
      const updatedResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      expect(updatedResponse.body.creditsRemaining).toBe(initialCredits - 1.5);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/credits/remaining')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });
  });

  describe('GET /credits/usage (Get Credit Usage)', () => {
    it('should return paginated credit usage history', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create some usage records first
      const usageRecords = [
        {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.5,
        },
        {
          operation: 'SQL_GENERATION',
          model: 'datakit-smart',
          inputTokens: 200,
          outputTokens: 100,
          creditsUsed: 3.0,
        },
      ];

      for (const usage of usageRecords) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, usage);
      }

      const response = await TestHelpers.authenticatedGet('/credits/usage', cookies)
        .expect(200);

      TestHelpers.expectPaginatedResponse(response, ['id', 'operation', 'model', 'creditsUsed', 'createdAt']);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      
      // Verify usage record structure
      const usage = response.body.data[0];
      expect(usage).toHaveProperty('operation');
      expect(usage).toHaveProperty('model');
      expect(usage).toHaveProperty('inputTokens');
      expect(usage).toHaveProperty('outputTokens');
      expect(usage).toHaveProperty('creditsUsed');
      expect(usage).toHaveProperty('createdAt');
    });

    it('should filter usage by operation type', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create different types of usage
      const usageTypes = [
        { operation: 'AI_COMPLETION', creditsUsed: 1.0 },
        { operation: 'SQL_GENERATION', creditsUsed: 2.0 },
        { operation: 'DATA_ANALYSIS', creditsUsed: 3.0 },
      ];

      for (const usage of usageTypes) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          ...usage,
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      const response = await TestHelpers.authenticatedGet('/credits/usage?operation=SQL_GENERATION', cookies)
        .expect(200);

      response.body.data.forEach((usage: any) => {
        expect(usage.operation).toBe('SQL_GENERATION');
      });
    });

    it('should filter usage by model', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create usage with different models
      const modelUsage = [
        { model: 'datakit-smart', creditsUsed: 1.5 },
        { model: 'datakit-fast', creditsUsed: 0.5 },
      ];

      for (const usage of modelUsage) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          inputTokens: 100,
          outputTokens: 50,
          ...usage,
        });
      }

      const response = await TestHelpers.authenticatedGet('/credits/usage?model=datakit-fast', cookies)
        .expect(200);

      response.body.data.forEach((usage: any) => {
        expect(usage.model).toBe('datakit-fast');
      });
    });

    it('should filter usage by date range', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create usage record
      await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.0,
      });

      const today = new Date().toISOString().split('T')[0];
      const response = await TestHelpers.authenticatedGet(`/credits/usage?startDate=${today}&endDate=${today}`, cookies)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should support pagination for large usage history', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create multiple usage records
      for (let i = 0; i < 10; i++) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100 + i,
          outputTokens: 50 + i,
          creditsUsed: 1.0 + i * 0.1,
        });
      }

      const response = await TestHelpers.authenticatedGet('/credits/usage?limit=5&page=1', cookies)
        .expect(200);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.meta.limit).toBe(5);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(10);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/credits/usage')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });
  });

  describe('POST /credits/usage (Record Credit Usage)', () => {
    it('should successfully record credit usage', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const usageData = CreditFixtures.createCreditUsageData({
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 150,
        outputTokens: 75,
        creditsUsed: 2.25,
      });

      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('operation', usageData.operation);
      expect(response.body).toHaveProperty('model', usageData.model);
      expect(response.body).toHaveProperty('inputTokens', usageData.inputTokens);
      expect(response.body).toHaveProperty('outputTokens', usageData.outputTokens);
      expect(response.body).toHaveProperty('creditsUsed', usageData.creditsUsed);
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should record usage for different operation types', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const operations = ['AI_COMPLETION', 'AI_STREAM', 'SQL_GENERATION', 'DATA_ANALYSIS'];

      for (const operation of operations) {
        const usageData = {
          operation,
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.5,
        };

        const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
          .expect(201);

        expect(response.body.operation).toBe(operation);
      }
    });

    it('should record usage for different models', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const models = ['datakit-smart', 'datakit-fast'];

      for (const model of models) {
        const usageData = {
          operation: 'AI_COMPLETION',
          model,
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: model === 'datakit-smart' ? 1.5 : 0.4,
        };

        const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
          .expect(201);

        expect(response.body.model).toBe(model);
      }
    });

    it('should include workspace ID when specified', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get user's workspace
      const workspacesResponse = await TestHelpers.authenticatedGet('/workspaces', cookies);
      const workspaceId = workspacesResponse.body.data[0].id;

      const usageData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
        workspaceId,
      };

      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(201);

      expect(response.body).toHaveProperty('workspaceId', workspaceId);
    });

    it('should reject usage with invalid operation type', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const usageData = {
        operation: 'INVALID_OPERATION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      };

      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'operation');
    });

    it('should reject usage with negative credit amounts', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const usageData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: -1.5, // Negative credits
      };

      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'creditsUsed');
    });

    it('should reject usage with invalid token counts', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const usageData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: -50, // Negative tokens
        outputTokens: 50,
        creditsUsed: 1.5,
      };

      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'inputTokens');
    });

    it('should reject unauthenticated usage recording', async () => {
      const usageData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      };

      const response = await request(app.getHttpServer())
        .post('/credits/usage')
        .send(usageData)
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });

    it('should prevent usage recording when credits are exhausted', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First exhaust all credits
      const remainingResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const remainingCredits = remainingResponse.body.creditsRemaining;

      // Use all remaining credits
      if (remainingCredits > 0) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 1000,
          outputTokens: 500,
          creditsUsed: remainingCredits,
        });
      }

      // Try to use more credits
      const usageData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      };

      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, usageData)
        .expect(402); // Payment required / insufficient credits

      expect(response.body.message).toContain('credit');
    });
  });

  describe('GET /credits/stats (Credit Statistics)', () => {
    it('should return comprehensive credit statistics', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create some usage data
      const usageRecords = [
        { operation: 'AI_COMPLETION', creditsUsed: 1.5 },
        { operation: 'SQL_GENERATION', creditsUsed: 3.0 },
        { operation: 'DATA_ANALYSIS', creditsUsed: 5.0 },
      ];

      for (const usage of usageRecords) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          ...usage,
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      const response = await TestHelpers.authenticatedGet('/credits/stats', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('totalCreditsUsed');
      expect(response.body).toHaveProperty('creditsRemaining');
      expect(response.body).toHaveProperty('usageByOperation');
      expect(response.body).toHaveProperty('usageByModel');
      expect(response.body).toHaveProperty('dailyUsage');
      expect(response.body).toHaveProperty('weeklyUsage');
      expect(response.body).toHaveProperty('monthlyUsage');
    });

    it('should return usage breakdown by operation type', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create specific usage patterns
      const usageData = [
        { operation: 'AI_COMPLETION', creditsUsed: 2.0 },
        { operation: 'AI_COMPLETION', creditsUsed: 1.5 },
        { operation: 'SQL_GENERATION', creditsUsed: 3.0 },
      ];

      for (const usage of usageData) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          ...usage,
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
        });
      }

      const response = await TestHelpers.authenticatedGet('/credits/stats', cookies)
        .expect(200);

      expect(response.body.usageByOperation).toHaveProperty('AI_COMPLETION');
      expect(response.body.usageByOperation).toHaveProperty('SQL_GENERATION');
      expect(response.body.usageByOperation.AI_COMPLETION).toBe(3.5); // 2.0 + 1.5
      expect(response.body.usageByOperation.SQL_GENERATION).toBe(3.0);
    });

    it('should return usage breakdown by model', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const usageData = [
        { model: 'datakit-smart', creditsUsed: 3.0 },
        { model: 'datakit-fast', creditsUsed: 1.0 },
        { model: 'datakit-smart', creditsUsed: 2.0 },
      ];

      for (const usage of usageData) {
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          inputTokens: 100,
          outputTokens: 50,
          ...usage,
        });
      }

      const response = await TestHelpers.authenticatedGet('/credits/stats', cookies)
        .expect(200);

      expect(response.body.usageByModel).toHaveProperty('datakit-smart');
      expect(response.body.usageByModel).toHaveProperty('datakit-fast');
      expect(response.body.usageByModel['datakit-smart']).toBe(5.0); // 3.0 + 2.0
      expect(response.body.usageByModel['datakit-fast']).toBe(1.0);
    });

    it('should return time-based usage statistics', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Create usage record
      await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      });

      const response = await TestHelpers.authenticatedGet('/credits/stats', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('dailyUsage');
      expect(response.body).toHaveProperty('weeklyUsage');
      expect(response.body).toHaveProperty('monthlyUsage');
      expect(typeof response.body.dailyUsage).toBe('number');
      expect(response.body.dailyUsage).toBeGreaterThan(0);
    });

    it('should support custom date ranges for statistics', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      });

      const today = new Date().toISOString().split('T')[0];
      const response = await TestHelpers.authenticatedGet(`/credits/stats?startDate=${today}&endDate=${today}`, cookies)
        .expect(200);

      expect(response.body).toHaveProperty('totalCreditsUsed');
      expect(response.body.totalCreditsUsed).toBeGreaterThan(0);
    });
  });

  describe('POST /credits/estimate (Estimate Credit Cost)', () => {
    it('should estimate credit cost for AI completion', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const estimationData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        estimatedInputTokens: 200,
        estimatedOutputTokens: 100,
      };

      const response = await TestHelpers.authenticatedPost('/credits/estimate', cookies, estimationData)
        .expect(200);

      expect(response.body).toHaveProperty('estimatedCredits');
      expect(response.body).toHaveProperty('inputTokenCost');
      expect(response.body).toHaveProperty('outputTokenCost');
      expect(response.body).toHaveProperty('totalCost');
      expect(response.body).toHaveProperty('model', estimationData.model);
      expect(typeof response.body.estimatedCredits).toBe('number');
      expect(response.body.estimatedCredits).toBeGreaterThan(0);
    });

    it('should provide different estimates for different models', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const smartEstimate = await TestHelpers.authenticatedPost('/credits/estimate', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50,
      });

      const fastEstimate = await TestHelpers.authenticatedPost('/credits/estimate', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-fast',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50,
      });

      expect(smartEstimate.body.estimatedCredits).toBeGreaterThan(fastEstimate.body.estimatedCredits);
    });

    it('should estimate costs for different operation types', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const operations = ['AI_COMPLETION', 'SQL_GENERATION', 'DATA_ANALYSIS'];
      const estimates = [];

      for (const operation of operations) {
        const response = await TestHelpers.authenticatedPost('/credits/estimate', cookies, {
          operation,
          model: 'datakit-smart',
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50,
        });

        estimates.push(response.body);
      }

      estimates.forEach(estimate => {
        expect(estimate).toHaveProperty('estimatedCredits');
        expect(estimate.estimatedCredits).toBeGreaterThan(0);
      });
    });

    it('should handle zero token estimates', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const estimationData = {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
      };

      const response = await TestHelpers.authenticatedPost('/credits/estimate', cookies, estimationData)
        .expect(200);

      expect(response.body.estimatedCredits).toBe(0);
    });

    it('should reject invalid estimation parameters', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const invalidData = {
        operation: 'INVALID_OPERATION',
        model: 'datakit-smart',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50,
      };

      const response = await TestHelpers.authenticatedPost('/credits/estimate', cookies, invalidData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'operation');
    });
  });

  describe('Credit Limit Enforcement', () => {
    it('should prevent operations when credit limit is reached', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get current credit limit
      const remainingResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const creditLimit = remainingResponse.body.creditsLimit;

      if (creditLimit > 0) {
        // Use all available credits
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 1000,
          outputTokens: 500,
          creditsUsed: creditLimit,
        });

        // Try to use more credits
        const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 100,
          outputTokens: 50,
          creditsUsed: 1.0,
        })
        .expect(402);

        expect(response.body.message).toContain('insufficient');
      }
    });

    it('should allow operations for unlimited credit plans', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to ENTERPRISE (unlimited)
      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, {
        planType: 'ENTERPRISE',
        paymentMethodId: 'pm_card_visa',
      });

      // Should be able to use large amounts of credits
      const response = await TestHelpers.authenticatedPost('/credits/usage', cookies, {
        operation: 'AI_COMPLETION',
        model: 'datakit-smart',
        inputTokens: 10000,
        outputTokens: 5000,
        creditsUsed: 1000,
      })
      .expect(201);

      expect(response.body.creditsUsed).toBe(1000);
    });

    it('should provide clear error messages for credit exhaustion', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Get current credits
      const remainingResponse = await TestHelpers.authenticatedGet('/credits/remaining', cookies);
      const remainingCredits = remainingResponse.body.creditsRemaining;

      if (remainingCredits > 0) {
        // Exhaust credits
        await TestHelpers.authenticatedPost('/credits/usage', cookies, {
          operation: 'AI_COMPLETION',
          model: 'datakit-smart',
          inputTokens: 1000,
          outputTokens: 500,
          creditsUsed: remainingCredits,
        });

        // Check status
        const statusResponse = await TestHelpers.authenticatedGet('/credits/status', cookies)
          .expect(200);

        expect(statusResponse.body).toHaveProperty('hasCredits', false);
        expect(statusResponse.body).toHaveProperty('message');
        expect(statusResponse.body.message).toContain('exhausted');
      }
    });
  });

  describe('Credit Reset and Renewal', () => {
    it('should show next credit reset date', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/credits/remaining', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('resetDate');
      expect(new Date(response.body.resetDate)).toBeInstanceOf(Date);
      expect(new Date(response.body.resetDate).getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle credit renewal for paid plans', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to paid plan
      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      });

      const response = await TestHelpers.authenticatedGet('/credits/renewal-info', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('renewalDate');
      expect(response.body).toHaveProperty('renewalAmount');
      expect(response.body).toHaveProperty('autoRenewal');
    });
  });
});