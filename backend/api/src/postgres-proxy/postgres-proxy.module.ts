import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresProxyController } from './postgres-proxy.controller';
import { PostgresProxyService } from './postgres-proxy.service';
import { PostgresConnection } from './entities/postgres-connection.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostgresConnection]),
    UsersModule,
  ],
  controllers: [PostgresProxyController],
  providers: [PostgresProxyService],
  exports: [PostgresProxyService],
})
export class PostgresProxyModule {}