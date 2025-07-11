import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Waitlist, WaitlistStatus } from './entities/waitlist.entity';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { SlackService } from '../slack/slack.service';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private waitlistRepository: Repository<Waitlist>,
    private slackService: SlackService,
  ) {}

  async create(createWaitlistDto: CreateWaitlistDto): Promise<Waitlist> {
    const { email, featureName, userId, metadata } = createWaitlistDto;

    const existing = await this.waitlistRepository.findOne({
      where: { email, featureName },
    });

    if (existing) {
      throw new ConflictException(
        'You are already on the waitlist for this feature',
      );
    }

    const waitlistEntry = this.waitlistRepository.create({
      email,
      featureName,
      userId,
      metadata,
      status: WaitlistStatus.PENDING,
    });

    const savedEntry = await this.waitlistRepository.save(waitlistEntry);

    // Send Slack notification for new waitlist signup
    try {
      await this.slackService.notifyWaitlistSignup({
        id: savedEntry.id,
        email: savedEntry.email,
        featureName: savedEntry.featureName,
        userId: savedEntry.userId,
      });
    } catch (error) {
      // Log but don't fail waitlist signup if Slack notification fails
      console.warn(
        'Failed to send Slack notification for waitlist signup:',
        error,
      );
    }

    return savedEntry;
  }

  async findAll(): Promise<Waitlist[]> {
    return this.waitlistRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByFeature(featureName: string): Promise<Waitlist[]> {
    return this.waitlistRepository.find({
      where: { featureName },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<Waitlist[]> {
    return this.waitlistRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByEmail(email: string): Promise<Waitlist[]> {
    return this.waitlistRepository.find({
      where: { email },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: WaitlistStatus): Promise<Waitlist> {
    const waitlistEntry = await this.waitlistRepository.findOne({
      where: { id },
    });

    if (!waitlistEntry) {
      throw new NotFoundException('Waitlist entry not found');
    }

    waitlistEntry.status = status;
    return this.waitlistRepository.save(waitlistEntry);
  }

  async remove(id: string): Promise<void> {
    const result = await this.waitlistRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Waitlist entry not found');
    }
  }

  async getStats(): Promise<{
    total: number;
    byFeature: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const total = await this.waitlistRepository.count();

    const byFeature = await this.waitlistRepository
      .createQueryBuilder('waitlist')
      .select('waitlist.featureName', 'feature')
      .addSelect('COUNT(*)', 'count')
      .groupBy('waitlist.featureName')
      .getRawMany();

    const byStatus = await this.waitlistRepository
      .createQueryBuilder('waitlist')
      .select('waitlist.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('waitlist.status')
      .getRawMany();

    return {
      total,
      byFeature: byFeature.reduce((acc, curr) => {
        acc[curr.feature] = parseInt(curr.count);
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, curr) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      }, {}),
    };
  }
}
