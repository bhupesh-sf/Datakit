import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { StreamingService } from './streaming.service';
import { CreditsModule } from '../credits/credits.module';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterService } from './queue/rate-limiter.service';

@Module({
  imports: [CreditsModule, ConfigModule],
  controllers: [AIController],
  providers: [AIService, StreamingService, RateLimiterService],
  exports: [AIService],
})
export class AIModule {}
