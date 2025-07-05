import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { CreditUsage } from '../../credits/entities/credit-usage.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../../workspaces/entities/workspace-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  currentWorkspaceId: string;

  @ManyToOne(() => Workspace, { nullable: true })
  @JoinColumn({ name: 'currentWorkspaceId' })
  currentWorkspace: Workspace;

  @OneToMany(() => Workspace, workspace => workspace.owner)
  ownedWorkspaces: Workspace[];

  @OneToMany(() => WorkspaceMember, member => member.user)
  workspaceMemberships: WorkspaceMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Subscription, subscription => subscription.user)
  subscription: Subscription;

  @OneToMany(() => CreditUsage, creditUsage => creditUsage.user)
  creditUsages: CreditUsage[];

  @OneToMany(() => RefreshToken, refreshToken => refreshToken.user, { lazy: true })
  refreshTokens: RefreshToken[];
}