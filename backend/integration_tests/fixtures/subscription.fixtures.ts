import { Subscription } from '../../api/src/subscriptions/entities/subscription.entity';

export interface CreateSubscriptionData {
  userId: string;
  planType: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'PAST_DUE';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export class SubscriptionFixtures {
  static createSubscriptionData(overrides: Partial<CreateSubscriptionData> = {}): CreateSubscriptionData {
    const now = new Date();
    const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const defaults: CreateSubscriptionData = {
      userId: '',
      planType: 'FREE',
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: monthFromNow,
    };

    return { ...defaults, ...overrides };
  }

  // Predefined subscription fixtures
  static readonly FREE_SUBSCRIPTION = {
    planType: 'FREE' as const,
    status: 'ACTIVE' as const,
  };

  static readonly STARTER_SUBSCRIPTION = {
    planType: 'STARTER' as const,
    status: 'ACTIVE' as const,
    stripeCustomerId: 'cus_starter_test',
    stripeSubscriptionId: 'sub_starter_test',
  };

  static readonly PRO_SUBSCRIPTION = {
    planType: 'PRO' as const,
    status: 'ACTIVE' as const,
    stripeCustomerId: 'cus_pro_test',
    stripeSubscriptionId: 'sub_pro_test',
  };

  static readonly ENTERPRISE_SUBSCRIPTION = {
    planType: 'ENTERPRISE' as const,
    status: 'ACTIVE' as const,
    stripeCustomerId: 'cus_enterprise_test',
    stripeSubscriptionId: 'sub_enterprise_test',
  };

  // Trial subscriptions
  static readonly TRIAL_SUBSCRIPTION = {
    planType: 'PRO' as const,
    status: 'ACTIVE' as const,
    trialStart: new Date(),
    trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
  };

  static readonly EXPIRED_TRIAL_SUBSCRIPTION = {
    planType: 'PRO' as const,
    status: 'EXPIRED' as const,
    trialStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    trialEnd: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  };

  // Canceled subscriptions
  static readonly CANCELED_SUBSCRIPTION = {
    planType: 'PRO' as const,
    status: 'CANCELED' as const,
    canceledAt: new Date(),
  };

  static readonly PAST_DUE_SUBSCRIPTION = {
    planType: 'STARTER' as const,
    status: 'PAST_DUE' as const,
    currentPeriodEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days overdue
  };

  // Subscription lifecycle helpers
  static createActiveSubscription(planType: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE', userId: string): CreateSubscriptionData {
    return this.createSubscriptionData({
      userId,
      planType,
      status: 'ACTIVE',
      ...(planType !== 'FREE' && {
        stripeCustomerId: `cus_${planType.toLowerCase()}_${userId}`,
        stripeSubscriptionId: `sub_${planType.toLowerCase()}_${userId}`,
      }),
    });
  }

  static createTrialSubscription(userId: string, daysRemaining: number = 14): CreateSubscriptionData {
    const trialStart = new Date();
    const trialEnd = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
    
    return this.createSubscriptionData({
      userId,
      planType: 'PRO',
      status: 'ACTIVE',
      trialStart,
      trialEnd,
    });
  }

  static createExpiredSubscription(userId: string, planType: 'STARTER' | 'PRO' | 'ENTERPRISE'): CreateSubscriptionData {
    return this.createSubscriptionData({
      userId,
      planType,
      status: 'EXPIRED',
      currentPeriodEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
  }

  static createCanceledSubscription(userId: string, planType: 'STARTER' | 'PRO' | 'ENTERPRISE'): CreateSubscriptionData {
    return this.createSubscriptionData({
      userId,
      planType,
      status: 'CANCELED',
      canceledAt: new Date(),
    });
  }

  // Batch creation helpers
  static createSubscriptionsForUsers(userIds: string[], planType: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE' = 'FREE'): CreateSubscriptionData[] {
    return userIds.map(userId => this.createActiveSubscription(planType, userId));
  }

  static createMixedSubscriptions(userIds: string[]): CreateSubscriptionData[] {
    const plans: Array<'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE'> = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
    
    return userIds.map((userId, index) => {
      const planType = plans[index % plans.length];
      return this.createActiveSubscription(planType, userId);
    });
  }

  // Upgrade/downgrade scenarios
  static createUpgradeScenario(userId: string): {
    from: CreateSubscriptionData;
    to: CreateSubscriptionData;
  } {
    return {
      from: this.createActiveSubscription('FREE', userId),
      to: this.createActiveSubscription('PRO', userId),
    };
  }

  static createDowngradeScenario(userId: string): {
    from: CreateSubscriptionData;
    to: CreateSubscriptionData;
  } {
    return {
      from: this.createActiveSubscription('PRO', userId),
      to: this.createActiveSubscription('STARTER', userId),
    };
  }
}