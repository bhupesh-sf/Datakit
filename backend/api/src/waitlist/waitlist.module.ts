import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { Waitlist } from './entities/waitlist.entity';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [TypeOrmModule.forFeature([Waitlist]), SlackModule],
  controllers: [WaitlistController],
  providers: [WaitlistService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
