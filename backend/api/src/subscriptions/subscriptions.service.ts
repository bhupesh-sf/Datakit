import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
  ) {}

  async createFreeSubscription(
    userId: string,
    workspaceId?: string,
  ): Promise<Subscription> {
    const monthlyCredits = this.getMonthlyCredits(SubscriptionPlan.FREE);

    const subscription = this.subscriptionsRepository.create({
      userId, // Keep for backward compatibility
      workspaceId,
      planType: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      creditsRemaining: monthlyCredits,
      monthlyCredits,
      creditsResetAt: this.getNextResetDate(),
    });

    return this.subscriptionsRepository.save(subscription);
  }

  async createWorkspaceSubscription(
    workspaceId: string,
    planType: SubscriptionPlan = SubscriptionPlan.FREE,
  ): Promise<Subscription> {
    const monthlyCredits = this.getMonthlyCredits(planType);

    const subscription = this.subscriptionsRepository.create({
      workspaceId,
      planType,
      status: SubscriptionStatus.ACTIVE,
      creditsRemaining: monthlyCredits,
      monthlyCredits,
      creditsResetAt: this.getNextResetDate(),
    });

    return this.subscriptionsRepository.save(subscription);
  }

  async findByUserId(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async updatePlan(
    userId: string,
    planType: SubscriptionPlan,
    stripeSubscriptionId?: string,
    stripePriceId?: string,
  ): Promise<Subscription> {
    const subscription = await this.findByUserId(userId);

    subscription.planType = planType;
    subscription.stripeSubscriptionId = stripeSubscriptionId;
    subscription.stripePriceId = stripePriceId;

    // Update monthly credits based on plan
    subscription.monthlyCredits = this.getMonthlyCredits(planType);

    return this.subscriptionsRepository.save(subscription);
  }

  async useCredits(userId: string, amount: number): Promise<boolean> {
    const subscription = await this.findByUserId(userId);

    // Team plan has unlimited credits
    if (subscription.planType === SubscriptionPlan.TEAM) {
      return true;
    }

    if (subscription.creditsRemaining < amount) {
      return false;
    }

    subscription.creditsRemaining -= amount;
    await this.subscriptionsRepository.save(subscription);
    return true;
  }

  async getCreditsRemaining(userId: string): Promise<number> {
    const subscription = await this.findByUserId(userId);

    // Team plan has unlimited credits
    if (subscription.planType === SubscriptionPlan.TEAM) {
      return -1;
    }

    return subscription.creditsRemaining;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Subscription> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { workspaceId },
      relations: ['workspace'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async useWorkspaceCredits(
    workspaceId: string,
    amount: number,
  ): Promise<boolean> {
    const subscription = await this.findByWorkspaceId(workspaceId);

    // Team plan has unlimited credits
    if (subscription.planType === SubscriptionPlan.TEAM) {
      return true;
    }

    if (subscription.creditsRemaining < amount) {
      return false;
    }

    subscription.creditsRemaining -= amount;
    await this.subscriptionsRepository.save(subscription);
    return true;
  }

  private getMonthlyCredits(planType: SubscriptionPlan): number {
    switch (planType) {
      case SubscriptionPlan.FREE:
        return 315; // €3 + 5% margin (€3.15 ≈ 315 credits at $0.01 per credit)
      case SubscriptionPlan.PRO:
        return 1575; // €15 + 5% margin (€15.75 ≈ 1575 credits at $0.01 per credit)
      case SubscriptionPlan.TEAM:
        return -1; // Unlimited
      default:
        return 315;
    }
  }

  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  // Reset credits monthly
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetMonthlyCredits() {
    const now = new Date();
    const subscriptions = await this.subscriptionsRepository.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
      },
    });

    for (const subscription of subscriptions) {
      if (subscription.creditsResetAt && subscription.creditsResetAt <= now) {
        subscription.creditsRemaining = subscription.monthlyCredits;
        subscription.creditsResetAt = this.getNextResetDate();
        await this.subscriptionsRepository.save(subscription);
      }
    }
  }
}
