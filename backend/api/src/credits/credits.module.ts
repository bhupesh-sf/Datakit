import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { CreditUsage } from './entities/credit-usage.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditUsage]),
    SubscriptionsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}