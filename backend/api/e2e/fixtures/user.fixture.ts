import { User } from '../../src/users/entities/user.entity';
import { SubscriptionPlan } from '../../src/subscriptions/entities/subscription.entity';

export class UserFixture {
  static createUserData(overrides: any = {}): any {
    return {
      email: `user-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Test User',
      ...overrides,
    };
  }

  static createVerifiedUser(overrides: any = {}): any {
    return this.createUserData({
      ...overrides,
    });
  }

  static createProUser(overrides: any = {}): any {
    return this.createVerifiedUser({
      ...overrides,
    });
  }
}

export class SubscriptionFixture {
  static createFreeSubscription(userId: string, overrides: any = {}) {
    return {
      userId,
      planType: SubscriptionPlan.FREE,
      status: 'active',
      creditsRemaining: 315,
      monthlyCredits: 315,
      creditsResetAt: new Date(),
      ...overrides,
    };
  }

  static createProSubscription(userId: string, overrides: any = {}) {
    return {
      userId,
      planType: SubscriptionPlan.PRO,
      status: 'active',
      creditsRemaining: 1575,
      monthlyCredits: 1575,
      creditsResetAt: new Date(),
      stripeSubscriptionId: 'sub_test_pro',
      stripePriceId: 'price_test_pro',
      ...overrides,
    };
  }
}

export class WorkspaceFixture {
  static createPersonalWorkspace(ownerId: string, overrides: any = {}) {
    return {
      name: `${Date.now()}'s Workspace`,
      ownerId,
      isPersonal: true,
      description: 'Personal workspace',
      ...overrides,
    };
  }

  static createTeamWorkspace(ownerId: string, overrides: any = {}) {
    return {
      name: `Team Workspace ${Date.now()}`,
      ownerId,
      isPersonal: false,
      description: 'Team workspace for collaboration',
      ...overrides,
    };
  }
}