import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { TestAppFactory } from './test-app.factory';
import { DatabaseUtils } from './database-utils';
import { HttpUtils } from './http-utils';
import { UserFixture, SubscriptionFixture } from './fixtures/user.fixture';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../src/subscriptions/entities/subscription.entity';

describe('Subscriptions (e2e)', () => {
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

  describe('GET /api/subscriptions/current', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return current subscription for authenticated user', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/current', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        planType: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        creditsRemaining: expect.any(Number),
        monthlyCredits: expect.any(Number),
        creditsResetAt: expect.any(String),
      });

      expect(Number(response.body.creditsRemaining)).toBe(315);
      expect(Number(response.body.monthlyCredits)).toBe(315);
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('get', '/subscriptions/current')
        .expect(401);
    });

    it('should return PRO subscription details', async () => {
      // Update user to PRO subscription
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        SubscriptionFixture.createProSubscription(user.id)
      );

      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/current', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        planType: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        creditsRemaining: expect.any(Number),
        monthlyCredits: expect.any(Number),
        stripeSubscriptionId: 'sub_test_pro',
        stripePriceId: 'price_test_pro',
      });

      expect(Number(response.body.creditsRemaining)).toBe(1575);
    });
  });

  describe('GET /api/subscriptions/plans', () => {
    it('should return available subscription plans', async () => {
      const response = await httpUtils
        .request('get', '/subscriptions/plans')
        .expect(200);

      expect(response.body).toHaveProperty('plans');
      expect(Array.isArray(response.body.plans)).toBe(true);
      
      const planTypes = response.body.plans.map(plan => plan.type);
      expect(planTypes).toEqual(
        expect.arrayContaining([
          SubscriptionPlan.FREE,
          SubscriptionPlan.PRO,
        ])
      );

      // Check FREE plan details
      const freePlan = response.body.plans.find(p => p.type === SubscriptionPlan.FREE);
      expect(freePlan).toMatchObject({
        type: SubscriptionPlan.FREE,
        name: expect.any(String),
        price: 0,
        credits: 315,
        features: expect.any(Array),
      });

      // Check PRO plan details
      const proPlan = response.body.plans.find(p => p.type === SubscriptionPlan.PRO);
      expect(proPlan).toMatchObject({
        type: SubscriptionPlan.PRO,
        name: expect.any(String),
        price: expect.any(Number),
        credits: 1575,
        features: expect.any(Array),
      });
    });

    it('should not require authentication for public plans', async () => {
      await httpUtils
        .request('get', '/subscriptions/plans')
        .expect(200);
    });
  });

  describe('POST /api/subscriptions/upgrade', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should upgrade from FREE to PRO plan', async () => {
      const upgradeRequest = {
        planType: SubscriptionPlan.PRO,
        paymentMethodId: 'pm_test_card_visa',
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/subscriptions/upgrade', accessToken)
        .send(upgradeRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        subscription: expect.objectContaining({
          planType: SubscriptionPlan.PRO,
          status: SubscriptionStatus.ACTIVE,
        }),
        message: expect.any(String),
      });

      // Verify in database
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      const subscription = await subscriptionRepo.findOne({ 
        where: { userId: user.id } 
      });
      
      expect(subscription?.planType).toBe(SubscriptionPlan.PRO);
      expect(Number(subscription?.creditsRemaining)).toBe(1575);
    });

    it('should reject upgrade without payment method', async () => {
      const upgradeRequest = {
        planType: SubscriptionPlan.PRO,
        // Missing paymentMethodId
      };

      await httpUtils
        .authenticatedRequest('post', '/subscriptions/upgrade', accessToken)
        .send(upgradeRequest)
        .expect(400);
    });

    it('should reject invalid plan type', async () => {
      const upgradeRequest = {
        planType: 'INVALID_PLAN',
        paymentMethodId: 'pm_test_card_visa',
      };

      await httpUtils
        .authenticatedRequest('post', '/subscriptions/upgrade', accessToken)
        .send(upgradeRequest)
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      const upgradeRequest = {
        planType: SubscriptionPlan.PRO,
        paymentMethodId: 'pm_test_card_visa',
      };

      await httpUtils
        .request('post', '/subscriptions/upgrade')
        .send(upgradeRequest)
        .expect(401);
    });

    it('should handle upgrade from same plan gracefully', async () => {
      // User is already on FREE plan
      const upgradeRequest = {
        planType: SubscriptionPlan.FREE,
        paymentMethodId: 'pm_test_card_visa',
      };

      const response = await httpUtils
        .authenticatedRequest('post', '/subscriptions/upgrade', accessToken)
        .send(upgradeRequest)
        .expect(200);

      expect(response.body.message).toContain('already');
    });
  });

  describe('POST /api/subscriptions/cancel', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;

      // Upgrade to PRO first
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        SubscriptionFixture.createProSubscription(user.id)
      );
    });

    it('should cancel PRO subscription', async () => {
      const response = await httpUtils
        .authenticatedRequest('post', '/subscriptions/cancel', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.any(String),
        subscription: expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
        }),
      });

      // Verify in database
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      const subscription = await subscriptionRepo.findOne({ 
        where: { userId: user.id } 
      });
      
      expect(subscription?.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should reject cancellation of FREE plan', async () => {
      // Reset to FREE plan
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        { planType: SubscriptionPlan.FREE }
      );

      await httpUtils
        .authenticatedRequest('post', '/subscriptions/cancel', accessToken)
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('post', '/subscriptions/cancel')
        .expect(401);
    });
  });

  describe('GET /api/subscriptions/billing-history', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should return empty billing history for FREE user', async () => {
      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/billing-history', accessToken)
        .expect(200);

      expect(response.body).toMatchObject({
        invoices: [],
        hasMore: false,
      });
    });

    it('should return billing history for PRO user', async () => {
      // Upgrade to PRO
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        SubscriptionFixture.createProSubscription(user.id)
      );

      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/billing-history', accessToken)
        .expect(200);

      expect(response.body).toHaveProperty('invoices');
      expect(Array.isArray(response.body.invoices)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      await httpUtils
        .request('get', '/subscriptions/billing-history')
        .expect(401);
    });
  });

  describe('Credit Reset Logic', () => {
    let accessToken: string;
    let user: any;

    beforeEach(async () => {
      const result = await httpUtils.signup(UserFixture.createVerifiedUser());
      accessToken = result.accessToken;
      user = result.user;
    });

    it('should reset credits when credits reset date has passed', async () => {
      // Set credits to zero and reset date to past
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        {
          creditsRemaining: 0,
          creditsResetAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        }
      );

      // Access subscription endpoint which should trigger reset
      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/current', accessToken)
        .expect(200);

      // Credits should be reset to monthly allowance
      expect(Number(response.body.creditsRemaining)).toBe(315);
      
      // Reset date should be updated to next month
      const resetDate = new Date(response.body.creditsResetAt);
      expect(resetDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should not reset credits if reset date has not passed', async () => {
      // Set credits to low value but reset date in future
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      
      await subscriptionRepo.update(
        { userId: user.id },
        {
          creditsRemaining: 50,
          creditsResetAt: futureDate,
        }
      );

      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/current', accessToken)
        .expect(200);

      // Credits should remain unchanged
      expect(Number(response.body.creditsRemaining)).toBe(50);
    });

    it('should handle credit reset for different plan types', async () => {
      // Upgrade to PRO and set past reset date
      const subscriptionRepo = DatabaseUtils.getRepository(app, Subscription);
      await subscriptionRepo.update(
        { userId: user.id },
        {
          ...SubscriptionFixture.createProSubscription(user.id),
          creditsRemaining: 0,
          creditsResetAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }
      );

      const response = await httpUtils
        .authenticatedRequest('get', '/subscriptions/current', accessToken)
        .expect(200);

      // Should reset to PRO monthly credits
      expect(Number(response.body.creditsRemaining)).toBe(1575);
      expect(response.body.planType).toBe(SubscriptionPlan.PRO);
    });
  });
});