import { CreditUsage } from '../../api/src/credits/entities/credit-usage.entity';

export interface CreateCreditUsageData {
  userId: string;
  workspaceId?: string;
  operation: 'AI_COMPLETION' | 'AI_STREAM' | 'SQL_GENERATION' | 'DATA_ANALYSIS';
  model: string;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  createdAt?: Date;
}

export class CreditFixtures {
  static createCreditUsageData(overrides: Partial<CreateCreditUsageData> = {}): CreateCreditUsageData {
    const defaults: CreateCreditUsageData = {
      userId: '',
      operation: 'AI_COMPLETION',
      model: 'datakit-smart',
      inputTokens: 100,
      outputTokens: 50,
      creditsUsed: 1.5,
      createdAt: new Date(),
    };

    return { ...defaults, ...overrides };
  }

  // Predefined credit usage fixtures
  static readonly SMALL_AI_COMPLETION = {
    operation: 'AI_COMPLETION' as const,
    model: 'datakit-smart',
    inputTokens: 50,
    outputTokens: 25,
    creditsUsed: 0.75,
  };

  static readonly LARGE_AI_COMPLETION = {
    operation: 'AI_COMPLETION' as const,
    model: 'datakit-smart',
    inputTokens: 2000,
    outputTokens: 1000,
    creditsUsed: 15.0,
  };

  static readonly FAST_MODEL_USAGE = {
    operation: 'AI_COMPLETION' as const,
    model: 'datakit-fast',
    inputTokens: 100,
    outputTokens: 50,
    creditsUsed: 0.4,
  };

  static readonly SQL_GENERATION_USAGE = {
    operation: 'SQL_GENERATION' as const,
    model: 'datakit-smart',
    inputTokens: 200,
    outputTokens: 100,
    creditsUsed: 3.0,
  };

  static readonly DATA_ANALYSIS_USAGE = {
    operation: 'DATA_ANALYSIS' as const,
    model: 'datakit-smart',
    inputTokens: 500,
    outputTokens: 300,
    creditsUsed: 8.0,
  };

  static readonly STREAMING_USAGE = {
    operation: 'AI_STREAM' as const,
    model: 'datakit-smart',
    inputTokens: 150,
    outputTokens: 200,
    creditsUsed: 3.5,
  };

  // Usage scenarios
  static readonly HEAVY_USER_USAGE = {
    operation: 'AI_COMPLETION' as const,
    model: 'datakit-smart',
    inputTokens: 5000,
    outputTokens: 3000,
    creditsUsed: 50.0,
  };

  static readonly LIGHT_USER_USAGE = {
    operation: 'AI_COMPLETION' as const,
    model: 'datakit-fast',
    inputTokens: 20,
    outputTokens: 10,
    creditsUsed: 0.1,
  };

  // Time-based scenarios
  static createUsageFromDaysAgo(days: number, userId: string): CreateCreditUsageData {
    const date = new Date();
    date.setDate(date.getDate() - days);
    
    return this.createCreditUsageData({
      userId,
      createdAt: date,
    });
  }

  static createMonthlyUsage(userId: string, month: number, year: number): CreateCreditUsageData[] {
    const usages: CreateCreditUsageData[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      // Random number of operations per day (0-5)
      const operationsPerDay = Math.floor(Math.random() * 6);
      
      for (let op = 0; op < operationsPerDay; op++) {
        const date = new Date(year, month - 1, day);
        usages.push(this.createCreditUsageData({
          userId,
          createdAt: date,
          creditsUsed: Math.random() * 10, // Random credits 0-10
        }));
      }
    }
    
    return usages;
  }

  // Batch creation helpers
  static createDailyUsage(userId: string, operationsCount: number): CreateCreditUsageData[] {
    const usages: CreateCreditUsageData[] = [];
    
    for (let i = 0; i < operationsCount; i++) {
      const baseUsage = [
        this.SMALL_AI_COMPLETION,
        this.LARGE_AI_COMPLETION,
        this.SQL_GENERATION_USAGE,
        this.DATA_ANALYSIS_USAGE,
        this.STREAMING_USAGE,
      ][i % 5];
      
      usages.push(this.createCreditUsageData({
        userId,
        ...baseUsage,
      }));
    }
    
    return usages;
  }

  static createWorkspaceUsage(userId: string, workspaceId: string, operationsCount: number): CreateCreditUsageData[] {
    return this.createDailyUsage(userId, operationsCount).map(usage => ({
      ...usage,
      workspaceId,
    }));
  }

  static createMultiUserUsage(userIds: string[], operationsPerUser: number = 5): CreateCreditUsageData[] {
    const allUsages: CreateCreditUsageData[] = [];
    
    userIds.forEach(userId => {
      const userUsages = this.createDailyUsage(userId, operationsPerUser);
      allUsages.push(...userUsages);
    });
    
    return allUsages;
  }

  // Credit limit scenarios
  static createUsageNearLimit(userId: string, remainingCredits: number = 5): CreateCreditUsageData[] {
    // Create usage that brings user close to their limit
    const usages: CreateCreditUsageData[] = [];
    
    // Add some historical usage
    usages.push(
      ...this.createDailyUsage(userId, 10).map(usage => ({
        ...usage,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      }))
    );
    
    // Add recent usage that brings them close to limit
    const recentUsage = this.createCreditUsageData({
      userId,
      creditsUsed: 100 - remainingCredits, // Assuming 100 credit limit
      operation: 'AI_COMPLETION',
    });
    
    usages.push(recentUsage);
    
    return usages;
  }

  static createUsageOverLimit(userId: string): CreateCreditUsageData[] {
    const usages = this.createUsageNearLimit(userId, 0);
    
    // Add usage that exceeds the limit
    usages.push(this.createCreditUsageData({
      userId,
      creditsUsed: 10, // This should put them over limit
      operation: 'AI_COMPLETION',
    }));
    
    return usages;
  }

  // Analytics scenarios
  static createUsageAnalyticsScenario(userId: string): {
    dailyUsage: CreateCreditUsageData[];
    weeklyUsage: CreateCreditUsageData[];
    monthlyUsage: CreateCreditUsageData[];
  } {
    const now = new Date();
    
    return {
      dailyUsage: this.createDailyUsage(userId, 5),
      weeklyUsage: Array.from({ length: 7 }, (_, i) => 
        this.createUsageFromDaysAgo(i, userId)
      ),
      monthlyUsage: this.createMonthlyUsage(userId, now.getMonth() + 1, now.getFullYear()),
    };
  }

  // Model comparison scenarios
  static createModelComparisonUsage(userId: string): CreateCreditUsageData[] {
    return [
      this.createCreditUsageData({
        userId,
        model: 'datakit-smart',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 1.5,
      }),
      this.createCreditUsageData({
        userId,
        model: 'datakit-fast',
        inputTokens: 100,
        outputTokens: 50,
        creditsUsed: 0.4,
      }),
    ];
  }
}