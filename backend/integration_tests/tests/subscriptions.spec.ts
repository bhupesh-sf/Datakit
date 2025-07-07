import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TestAppFactory } from '../setup/test-app.factory';
import { TestHelpers } from '../utils/test-helpers';
import { SubscriptionFixtures } from '../fixtures';

describe('Subscriptions CRUD Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await TestAppFactory.createTestApp();
  });

  describe('GET /subscriptions (List Subscriptions)', () => {
    it('should return current user subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
        name: 'Subscription User',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('planType', 'FREE'); // Default plan
      expect(response.body).toHaveProperty('status', 'ACTIVE');
      expect(response.body).toHaveProperty('currentPeriodStart');
      expect(response.body).toHaveProperty('currentPeriodEnd');
      expect(response.body).toHaveProperty('userId');
    });

    it('should include subscription usage statistics', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions?include=usage', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('usage');
      expect(response.body.usage).toHaveProperty('creditsUsed');
      expect(response.body.usage).toHaveProperty('creditsRemaining');
      expect(response.body.usage).toHaveProperty('resetDate');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/subscriptions')
        .expect(401);

      TestHelpers.expectUnauthorized(response);
    });
  });

  describe('GET /subscriptions/plans (List Available Plans)', () => {
    it('should return all available subscription plans', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions/plans', cookies)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const freePlan = response.body.find((plan: any) => plan.type === 'FREE');
      expect(freePlan).toBeDefined();
      expect(freePlan).toHaveProperty('name');
      expect(freePlan).toHaveProperty('price');
      expect(freePlan).toHaveProperty('features');
      expect(freePlan).toHaveProperty('credits');
    });

    it('should include plan features and limitations', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions/plans', cookies)
        .expect(200);

      const proPlan = response.body.find((plan: any) => plan.type === 'PRO');
      if (proPlan) {
        expect(proPlan).toHaveProperty('features');
        expect(Array.isArray(proPlan.features)).toBe(true);
        expect(proPlan).toHaveProperty('credits');
        expect(typeof proPlan.credits).toBe('number');
      }
    });

    it('should work for unauthenticated users (public endpoint)', async () => {
      const response = await request(app.getHttpServer())
        .get('/subscriptions/plans')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /subscriptions/upgrade (Upgrade Subscription)', () => {
    it('should successfully upgrade from FREE to PRO plan', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const upgradeData = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa', // Test payment method
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, upgradeData)
        .expect(200);

      expect(response.body).toHaveProperty('planType', 'PRO');
      expect(response.body).toHaveProperty('status', 'ACTIVE');
      expect(response.body).toHaveProperty('stripeSubscriptionId');
      expect(response.body).toHaveProperty('stripeCustomerId');
    });

    it('should successfully upgrade from STARTER to PRO plan', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to STARTER
      const starterUpgrade = {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, starterUpgrade)
        .expect(200);

      // Then upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      expect(response.body).toHaveProperty('planType', 'PRO');
      expect(response.body).toHaveProperty('status', 'ACTIVE');
    });

    it('should reject downgrade requests through upgrade endpoint', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Try to "upgrade" to STARTER (should be rejected)
      const downgradeData = {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, downgradeData)
        .expect(400);

      expect(response.body.message).toContain('downgrade');
    });

    it('should reject upgrade with invalid payment method', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const upgradeData = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_chargeDeclined',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, upgradeData)
        .expect(400);

      expect(response.body.message).toContain('payment');
    });

    it('should reject upgrade to invalid plan type', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const upgradeData = {
        planType: 'INVALID_PLAN',
        paymentMethodId: 'pm_card_visa',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, upgradeData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'planType');
    });

    it('should reject upgrade without payment method for paid plans', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const upgradeData = {
        planType: 'PRO',
        // Missing paymentMethodId
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, upgradeData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'paymentMethodId');
    });

    it('should handle trial period activation for new paid plans', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const upgradeData = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
        startTrial: true,
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, upgradeData)
        .expect(200);

      expect(response.body).toHaveProperty('planType', 'PRO');
      expect(response.body).toHaveProperty('trialStart');
      expect(response.body).toHaveProperty('trialEnd');
      expect(new Date(response.body.trialEnd)).toBeInstanceOf(Date);
    });
  });

  describe('POST /subscriptions/downgrade (Downgrade Subscription)', () => {
    it('should successfully schedule downgrade from PRO to STARTER', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Then schedule downgrade to STARTER
      const downgradeData = {
        planType: 'STARTER',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/downgrade', cookies, downgradeData)
        .expect(200);

      expect(response.body).toHaveProperty('planType', 'PRO'); // Current plan
      expect(response.body).toHaveProperty('scheduledDowngrade');
      expect(response.body.scheduledDowngrade).toHaveProperty('planType', 'STARTER');
      expect(response.body.scheduledDowngrade).toHaveProperty('effectiveDate');
    });

    it('should successfully downgrade to FREE plan immediately', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to STARTER
      const starterUpgrade = {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, starterUpgrade)
        .expect(200);

      // Then downgrade to FREE
      const downgradeData = {
        planType: 'FREE',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/downgrade', cookies, downgradeData)
        .expect(200);

      expect(response.body).toHaveProperty('planType', 'FREE');
      expect(response.body).toHaveProperty('status', 'ACTIVE');
      expect(response.body.stripeSubscriptionId).toBeFalsy();
    });

    it('should reject upgrade requests through downgrade endpoint', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const downgradeData = {
        planType: 'PRO', // Trying to upgrade from FREE to PRO
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/downgrade', cookies, downgradeData)
        .expect(400);

      expect(response.body.message).toContain('upgrade');
    });

    it('should reject downgrade to invalid plan type', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const downgradeData = {
        planType: 'INVALID_PLAN',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/downgrade', cookies, downgradeData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'planType');
    });
  });

  describe('POST /subscriptions/cancel (Cancel Subscription)', () => {
    it('should successfully cancel paid subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Then cancel subscription
      const cancelData = {
        reason: 'Testing cancellation',
        feedback: 'Good service, just testing',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, cancelData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'CANCELED');
      expect(response.body).toHaveProperty('canceledAt');
      expect(response.body).toHaveProperty('currentPeriodEnd'); // Should continue until period end
    });

    it('should handle immediate cancellation with refund', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Cancel immediately with refund
      const cancelData = {
        reason: 'Immediate cancellation',
        immediate: true,
        refund: true,
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, cancelData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'CANCELED');
      expect(response.body).toHaveProperty('planType', 'FREE'); // Should revert to FREE immediately
    });

    it('should reject cancellation of FREE plan', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const cancelData = {
        reason: 'Cannot cancel free plan',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, cancelData)
        .expect(400);

      expect(response.body.message).toContain('free');
    });

    it('should require cancellation reason', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Try to cancel without reason
      const cancelData = {};

      const response = await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, cancelData)
        .expect(400);

      TestHelpers.expectValidationError(response, 'reason');
    });
  });

  describe('POST /subscriptions/reactivate (Reactivate Subscription)', () => {
    it('should successfully reactivate canceled subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Cancel subscription
      const cancelData = {
        reason: 'Testing reactivation',
      };

      await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, cancelData)
        .expect(200);

      // Reactivate subscription
      const reactivateData = {
        paymentMethodId: 'pm_card_visa',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/reactivate', cookies, reactivateData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ACTIVE');
      expect(response.body).toHaveProperty('planType', 'PRO');
      expect(response.body.canceledAt).toBeFalsy();
    });

    it('should reject reactivation of active subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to PRO (active subscription)
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      // Try to reactivate active subscription
      const reactivateData = {
        paymentMethodId: 'pm_card_visa',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/reactivate', cookies, reactivateData)
        .expect(400);

      expect(response.body.message).toContain('active');
    });

    it('should require valid payment method for reactivation', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade and cancel
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, { reason: 'Test' })
        .expect(200);

      // Try to reactivate with invalid payment method
      const reactivateData = {
        paymentMethodId: 'pm_card_chargeDeclined',
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/reactivate', cookies, reactivateData)
        .expect(400);

      expect(response.body.message).toContain('payment');
    });
  });

  describe('GET /subscriptions/usage (Subscription Usage)', () => {
    it('should return current usage statistics', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions/usage', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('creditsUsed');
      expect(response.body).toHaveProperty('creditsRemaining');
      expect(response.body).toHaveProperty('creditsLimit');
      expect(response.body).toHaveProperty('resetDate');
      expect(response.body).toHaveProperty('usageByOperation');
      expect(typeof response.body.creditsUsed).toBe('number');
      expect(typeof response.body.creditsRemaining).toBe('number');
    });

    it('should return usage breakdown by operation type', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // TODO: Add some usage first through AI endpoints
      // For now, just check the structure

      const response = await TestHelpers.authenticatedGet('/subscriptions/usage', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('usageByOperation');
      expect(typeof response.body.usageByOperation).toBe('object');
    });

    it('should return usage history for specified period', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions/usage?period=monthly', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it('should handle different time periods', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const periods = ['daily', 'weekly', 'monthly'];

      for (const period of periods) {
        const response = await TestHelpers.authenticatedGet(`/subscriptions/usage?period=${period}`, cookies)
          .expect(200);

        expect(response.body).toHaveProperty('creditsUsed');
        expect(response.body).toHaveProperty('creditsRemaining');
      }
    });
  });

  describe('GET /subscriptions/billing (Billing Information)', () => {
    it('should return billing information for paid subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // First upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      const response = await TestHelpers.authenticatedGet('/subscriptions/billing', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('customer');
      expect(response.body).toHaveProperty('paymentMethods');
      expect(response.body).toHaveProperty('invoices');
      expect(response.body.customer).toHaveProperty('id');
      expect(Array.isArray(response.body.paymentMethods)).toBe(true);
      expect(Array.isArray(response.body.invoices)).toBe(true);
    });

    it('should return empty billing info for FREE plan', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      const response = await TestHelpers.authenticatedGet('/subscriptions/billing', cookies)
        .expect(200);

      expect(response.body.customer).toBeFalsy();
      expect(response.body.paymentMethods).toHaveLength(0);
      expect(response.body.invoices).toHaveLength(0);
    });

    it('should include upcoming invoice for active subscription', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade)
        .expect(200);

      const response = await TestHelpers.authenticatedGet('/subscriptions/billing?include=upcoming', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('upcomingInvoice');
      if (response.body.upcomingInvoice) {
        expect(response.body.upcomingInvoice).toHaveProperty('amount');
        expect(response.body.upcomingInvoice).toHaveProperty('dueDate');
      }
    });
  });

  describe('Subscription State Transitions', () => {
    it('should handle complete subscription lifecycle', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // 1. Start with FREE plan
      let subscription = await TestHelpers.authenticatedGet('/subscriptions', cookies);
      expect(subscription.body.planType).toBe('FREE');

      // 2. Upgrade to STARTER
      const starterUpgrade = {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      };

      subscription = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, starterUpgrade);
      expect(subscription.body.planType).toBe('STARTER');

      // 3. Upgrade to PRO
      const proUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
      };

      subscription = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, proUpgrade);
      expect(subscription.body.planType).toBe('PRO');

      // 4. Cancel subscription
      const cancelData = {
        reason: 'Lifecycle test',
      };

      subscription = await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, cancelData);
      expect(subscription.body.status).toBe('CANCELED');

      // 5. Reactivate subscription
      const reactivateData = {
        paymentMethodId: 'pm_card_visa',
      };

      subscription = await TestHelpers.authenticatedPost('/subscriptions/reactivate', cookies, reactivateData);
      expect(subscription.body.status).toBe('ACTIVE');
      expect(subscription.body.planType).toBe('PRO');
    });

    it('should handle trial expiration correctly', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Start trial
      const trialUpgrade = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
        startTrial: true,
      };

      const subscription = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, trialUpgrade);
      expect(subscription.body.trialStart).toBeTruthy();
      expect(subscription.body.trialEnd).toBeTruthy();

      // Check trial status
      const trialStatus = await TestHelpers.authenticatedGet('/subscriptions/trial-status', cookies)
        .expect(200);

      expect(trialStatus.body).toHaveProperty('isInTrial');
      expect(trialStatus.body).toHaveProperty('trialDaysRemaining');
      expect(trialStatus.body).toHaveProperty('trialEnd');
    });

    it('should prevent multiple trials for same user', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Start first trial
      const firstTrial = {
        planType: 'PRO',
        paymentMethodId: 'pm_card_visa',
        startTrial: true,
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, firstTrial)
        .expect(200);

      // Cancel and downgrade
      await TestHelpers.authenticatedPost('/subscriptions/cancel', cookies, { reason: 'Test' });
      await TestHelpers.authenticatedPost('/subscriptions/downgrade', cookies, { planType: 'FREE' });

      // Try to start second trial
      const secondTrial = {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
        startTrial: true,
      };

      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, secondTrial)
        .expect(400);

      expect(response.body.message).toContain('trial');
    });
  });

  describe('Subscription Limits and Validations', () => {
    it('should enforce credit limits for different plans', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Check FREE plan limits
      const freeUsage = await TestHelpers.authenticatedGet('/subscriptions/usage', cookies);
      expect(freeUsage.body.creditsLimit).toBe(100); // Assuming FREE has 100 credits

      // Upgrade to STARTER
      const starterUpgrade = {
        planType: 'STARTER',
        paymentMethodId: 'pm_card_visa',
      };

      await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, starterUpgrade);

      const starterUsage = await TestHelpers.authenticatedGet('/subscriptions/usage', cookies);
      expect(starterUsage.body.creditsLimit).toBeGreaterThan(100); // STARTER should have more credits
    });

    it('should validate plan transitions', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Try to upgrade from FREE directly to ENTERPRISE (if not allowed)
      const enterpriseUpgrade = {
        planType: 'ENTERPRISE',
        paymentMethodId: 'pm_card_visa',
      };

      // This might be allowed or not depending on business rules
      const response = await TestHelpers.authenticatedPost('/subscriptions/upgrade', cookies, enterpriseUpgrade);
      
      // Should either succeed or fail with a specific business rule error
      expect([200, 400]).toContain(response.status);
    });

    it('should handle subscription limits gracefully', async () => {
      const { cookies } = await TestHelpers.createAuthenticatedUser({
        email: TestHelpers.generateUniqueEmail(),
        password: 'TestPassword123!',
      });

      // Check if there are any account limits (e.g., number of workspaces, team members)
      const limits = await TestHelpers.authenticatedGet('/subscriptions/limits', cookies)
        .expect(200);

      expect(limits.body).toHaveProperty('workspaces');
      expect(limits.body).toHaveProperty('teamMembers');
      expect(limits.body).toHaveProperty('apiCalls');
      expect(typeof limits.body.workspaces).toBe('number');
    });
  });
});