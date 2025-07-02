import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { WorkspaceMember } from './workspace-member.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, user => user.ownedWorkspaces)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ default: true })
  isPersonal: boolean;

  @Column({ nullable: true })
  logoUrl: string;

  @OneToOne(() => Subscription, subscription => subscription.workspace)
  subscription: Subscription;

  @OneToMany(() => WorkspaceMember, member => member.workspace)
  members: WorkspaceMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}