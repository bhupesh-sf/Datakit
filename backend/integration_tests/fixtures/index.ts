// Central export file for all fixtures
export * from './user.fixtures';
export * from './workspace.fixtures';
export * from './subscription.fixtures';
export * from './credit.fixtures';
export * from './auth.fixtures';

// Combined fixture scenarios for complex integration tests
import { UserFixtures, CreateUserData } from './user.fixtures';
import { WorkspaceFixtures, CreateWorkspaceData } from './workspace.fixtures';
import { SubscriptionFixtures, CreateSubscriptionData } from './subscription.fixtures';
import { CreditFixtures, CreateCreditUsageData } from './credit.fixtures';
import { AuthFixtures, CreateRefreshTokenData } from './auth.fixtures';

export interface CompleteUserScenario {
  user: CreateUserData;
  subscription: CreateSubscriptionData;
  workspaces: CreateWorkspaceData[];
  creditUsage: CreateCreditUsageData[];
  refreshTokens: CreateRefreshTokenData[];
}

export class IntegratedFixtures {
  /**
   * Creates a complete user scenario with all related entities
   */
  static async createCompleteUserScenario(overrides: {
    user?: Partial<CreateUserData>;
    subscription?: Partial<CreateSubscriptionData>;
    workspaceCount?: number;
    creditUsageCount?: number;
    refreshTokenCount?: number;
  } = {}): Promise<CompleteUserScenario> {
    const user = await UserFixtures.createUserData(overrides.user);
    const userId = 'temp-user-id'; // Will be replaced with actual user ID after creation
    
    const subscription = SubscriptionFixtures.createSubscriptionData({
      userId,
      ...overrides.subscription,
    });

    const workspaces = WorkspaceFixtures.createMultipleWorkspaces(
      overrides.workspaceCount || 2,
      userId
    );

    const creditUsage = CreditFixtures.createDailyUsage(
      userId,
      overrides.creditUsageCount || 5
    );

    const refreshTokens = AuthFixtures.createMultipleRefreshTokens(
      userId,
      overrides.refreshTokenCount || 1
    );

    return {
      user,
      subscription,
      workspaces,
      creditUsage,
      refreshTokens,
    };
  }

  /**
   * Creates a team scenario with multiple users, shared workspaces, and collaborations
   */
  static async createTeamScenario(userCount: number = 3): Promise<{
    users: CreateUserData[];
    subscriptions: CreateSubscriptionData[];
    sharedWorkspace: CreateWorkspaceData;
    personalWorkspaces: CreateWorkspaceData[];
    creditUsage: CreateCreditUsageData[];
  }> {
    const users = await UserFixtures.createMultipleUsers(userCount);
    const userIds = users.map((_, index) => `user-${index}`); // Temporary IDs
    
    const subscriptions = SubscriptionFixtures.createMixedSubscriptions(userIds);
    
    const sharedWorkspace = WorkspaceFixtures.createWorkspaceData({
      name: 'Team Collaboration Workspace',
      description: 'Shared workspace for team collaboration',
      ownerId: userIds[0], // First user is the owner
    });

    const personalWorkspaces = users.map((user, index) =>
      WorkspaceFixtures.createWorkspaceData({
        ...WorkspaceFixtures.PERSONAL_WORKSPACE,
        ownerId: userIds[index],
        name: `${user.name}'s Personal Workspace`,
      })
    );

    const creditUsage = CreditFixtures.createMultiUserUsage(userIds, 3);

    return {
      users,
      subscriptions,
      sharedWorkspace,
      personalWorkspaces,
      creditUsage,
    };
  }

  /**
   * Creates an enterprise scenario with multiple plans and heavy usage
   */
  static async createEnterpriseScenario(): Promise<{
    enterpriseUsers: CreateUserData[];
    enterpriseSubscriptions: CreateSubscriptionData[];
    enterpriseWorkspace: CreateWorkspaceData;
    heavyCreditUsage: CreateCreditUsageData[];
  }> {
    const enterpriseUsers = await UserFixtures.createMultipleUsers(10);
    const userIds = enterpriseUsers.map((_, index) => `enterprise-user-${index}`);
    
    const enterpriseSubscriptions = userIds.map(userId =>
      SubscriptionFixtures.createActiveSubscription('ENTERPRISE', userId)
    );

    const enterpriseWorkspace = WorkspaceFixtures.createWorkspaceData({
      ...WorkspaceFixtures.ENTERPRISE_WORKSPACE,
      ownerId: userIds[0],
    });

    const heavyCreditUsage = CreditFixtures.createMultiUserUsage(userIds, 20);

    return {
      enterpriseUsers,
      enterpriseSubscriptions,
      enterpriseWorkspace,
      heavyCreditUsage,
    };
  }

  /**
   * Creates scenarios for testing subscription limits and credit exhaustion
   */
  static async createLimitTestingScenario(): Promise<{
    freeUser: CompleteUserScenario;
    nearLimitUser: CompleteUserScenario;
    overLimitUser: CompleteUserScenario;
  }> {
    const freeUser = await this.createCompleteUserScenario({
      subscription: { planType: 'FREE' },
      creditUsageCount: 10,
    });

    const nearLimitUser = await this.createCompleteUserScenario({
      subscription: { planType: 'STARTER' },
      creditUsageCount: 95, // Assuming 100 credit limit
    });

    const overLimitUser = await this.createCompleteUserScenario({
      subscription: { planType: 'STARTER' },
      creditUsageCount: 110, // Over the limit
    });

    return {
      freeUser,
      nearLimitUser,
      overLimitUser,
    };
  }

  /**
   * Creates scenarios for testing different authentication states
   */
  static createAuthTestingScenarios(userId: string, email: string): {
    validAuth: { cookies: Record<string, string> };
    expiredAuth: { cookies: Record<string, string> };
    invalidAuth: { cookies: Record<string, string> };
    noAuth: { cookies: Record<string, string> };
  } {
    return {
      validAuth: {
        cookies: AuthFixtures.createCookieAuthScenario(
          AuthFixtures.generateAccessToken(userId, email),
          AuthFixtures.generateRefreshToken(userId, email)
        ),
      },
      expiredAuth: {
        cookies: AuthFixtures.createExpiredCookieAuthScenario(userId, email),
      },
      invalidAuth: {
        cookies: AuthFixtures.createInvalidCookieAuthScenario(),
      },
      noAuth: {
        cookies: {},
      },
    };
  }
}