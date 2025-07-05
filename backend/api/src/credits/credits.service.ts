import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditUsage } from './entities/credit-usage.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';

// Credit costs per 1k tokens for different models
// DataKit models use Claude 3.5 models behind the scenes with our credit system
// 1 credit = $0.01 USD, with pricing based on Anthropic's API costs
const CREDIT_COSTS = {
  // Legacy models for existing API key users
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-haiku': { input: 0.8, output: 4 },
  'llama-3.1-70b': { input: 0, output: 0 }, // Free on Groq
  'llama-3.1-8b': { input: 0, output: 0 }, // Free on Groq

  // DataKit AI models - using Claude models behind the scenes
  // Converted from Anthropic pricing: $3/1M input, $15/1M output for Sonnet
  // Converted from Anthropic pricing: $0.80/1M input, $4/1M output for Haiku
  'datakit-smart': { input: 0.3, output: 1.5 }, // Claude 3.5 Sonnet backend (0.3 credits per 1K input, 1.5 per 1K output)
  'datakit-fast': { input: 0.08, output: 0.4 }, // Claude 3.5 Haiku backend (0.08 credits per 1K input, 0.4 per 1K output)

  // Alternative model IDs that map to the same backend models
  'claude-3-5-sonnet-20241022': { input: 0.3, output: 1.5 }, // Maps to datakit-smart
  'claude-3-5-haiku-20241022': { input: 0.08, output: 0.4 }, // Maps to datakit-fast
};

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(CreditUsage)
    private creditUsageRepository: Repository<CreditUsage>,
    private subscriptionsService: SubscriptionsService,
    private usersService: UsersService,
  ) {}

  calculateCredits(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const costs = CREDIT_COSTS[modelId] || { input: 1, output: 1 };
    const inputCredits = (inputTokens / 1000) * costs.input;
    const outputCredits = (outputTokens / 1000) * costs.output;
    return Number((inputCredits + outputCredits).toFixed(4));
  }

  async checkCredits(
    userId: string,
    estimatedCredits: number,
  ): Promise<boolean> {
    // Get user's current workspace
    const user = await this.usersService.findOne(userId);
    if (!user.currentWorkspaceId) {
      // Fallback to user-based credits for backward compatibility
      const remainingCredits =
        await this.subscriptionsService.getCreditsRemaining(userId);
      return remainingCredits === -1 || remainingCredits >= estimatedCredits;
    }

    // Check workspace credits
    const subscription = await this.subscriptionsService.findByWorkspaceId(
      user.currentWorkspaceId,
    );
    return (
      subscription.creditsRemaining === -1 ||
      subscription.creditsRemaining >= estimatedCredits
    );
  }

  async recordUsage(
    userId: string,
    modelId: string,
    provider: string,
    inputTokens: number,
    outputTokens: number,
    prompt?: string,
    response?: string,
    metadata?: Record<string, any>,
  ): Promise<CreditUsage> {
    const creditsUsed = this.calculateCredits(
      modelId,
      inputTokens,
      outputTokens,
    );

    // Get user's current workspace
    const user = await this.usersService.findOne(userId);
    const workspaceId = user.currentWorkspaceId;

    if (workspaceId) {
      // Deduct credits from workspace subscription
      await this.subscriptionsService.useWorkspaceCredits(
        workspaceId,
        creditsUsed,
      );
    } else {
      // Fallback to user-based credits
      await this.subscriptionsService.useCredits(userId, creditsUsed);
    }

    const usage = this.creditUsageRepository.create({
      userId,
      workspaceId,
      modelId,
      provider,
      inputTokens,
      outputTokens,
      creditsUsed,
      prompt,
      response,
      metadata,
    });

    return this.creditUsageRepository.save(usage);
  }

  async getUserUsageHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<[CreditUsage[], number]> {
    return this.creditUsageRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getUserUsageStats(userId: string): Promise<{
    totalCreditsUsed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    usageByModel: Record<string, number>;
    usageByProvider: Record<string, number>;
  }> {
    const usages = await this.creditUsageRepository.find({
      where: { userId },
    });

    const stats = {
      totalCreditsUsed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      usageByModel: {} as Record<string, number>,
      usageByProvider: {} as Record<string, number>,
    };

    for (const usage of usages) {
      stats.totalCreditsUsed += Number(usage.creditsUsed);
      stats.totalInputTokens += usage.inputTokens;
      stats.totalOutputTokens += usage.outputTokens;

      if (!stats.usageByModel[usage.modelId]) {
        stats.usageByModel[usage.modelId] = 0;
      }
      stats.usageByModel[usage.modelId] += Number(usage.creditsUsed);

      if (!stats.usageByProvider[usage.provider]) {
        stats.usageByProvider[usage.provider] = 0;
      }
      stats.usageByProvider[usage.provider] += Number(usage.creditsUsed);
    }

    return stats;
  }

  async estimateCredits(
    modelId: string,
    inputTokens: number,
    outputTokens: number = 1000, // Default estimated output
  ): Promise<number> {
    return this.calculateCredits(modelId, inputTokens, outputTokens);
  }

  async getRemainingCredits(userId: string): Promise<number> {
    const user = await this.usersService.findOne(userId);

    if (!user.currentWorkspaceId) {
      // Fallback to user-based credits
      return await this.subscriptionsService.getCreditsRemaining(userId);
    }

    // Get workspace credits
    const subscription = await this.subscriptionsService.findByWorkspaceId(
      user.currentWorkspaceId,
    );
    return subscription.creditsRemaining;
  }
}
