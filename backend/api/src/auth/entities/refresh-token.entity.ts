import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  token: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
    lazy: true,
  })
  user: User;

  @Column('timestamp')
  expiresAt: Date;

  @Column('boolean', { default: false })
  isRevoked: boolean;

  @Column('inet', { nullable: true })
  ipAddress?: string;

  @Column('text', { nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
