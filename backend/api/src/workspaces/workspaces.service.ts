import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember, WorkspaceMemberRole } from './entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionPlan } from '../subscriptions/entities/subscription.entity';
import * as crypto from 'crypto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async createPersonalWorkspace(user: User): Promise<Workspace> {
    const workspace = this.workspaceRepository.create({
      name: `${user.name || user.email}'s Workspace`,
      ownerId: user.id,
      isPersonal: true,
      description: 'Personal workspace',
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Create owner membership
    await this.memberRepository.save({
      workspaceId: savedWorkspace.id,
      userId: user.id,
      role: WorkspaceMemberRole.OWNER,
      acceptedAt: new Date(),
    });

    // Create free subscription for the workspace
    await this.subscriptionsService.createWorkspaceSubscription(savedWorkspace.id);

    // Set as current workspace
    await this.userRepository.update(user.id, {
      currentWorkspaceId: savedWorkspace.id,
    });

    return savedWorkspace;
  }

  async findAll(userId: string): Promise<Workspace[]> {
    // Get all workspace IDs where user is a member
    const memberships = await this.memberRepository.find({
      where: { userId, acceptedAt: Not(IsNull()) },
      relations: ['workspace', 'workspace.subscription'],
    });

    const workspaces = memberships.map(m => m.workspace);
    
    return workspaces.sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id },
      relations: ['owner', 'subscription', 'members'],
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is a member
    const isMember = await this.isUserMemberOfWorkspace(userId, id);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    return workspace;
  }

  async update(id: string, userId: string, updateData: Partial<Workspace>): Promise<Workspace> {
    const workspace = await this.findOne(id, userId);

    // Only owner can update
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only workspace owner can update');
    }

    Object.assign(workspace, updateData);
    return this.workspaceRepository.save(workspace);
  }

  async switchWorkspace(userId: string, workspaceId: string): Promise<void> {
    const workspace = await this.findOne(workspaceId, userId);
    
    await this.userRepository.update(userId, {
      currentWorkspaceId: workspace.id,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const workspace = await this.findOne(id, userId);

    // Prevent deleting personal workspace
    if (workspace.isPersonal) {
      throw new ForbiddenException('Cannot delete personal workspace');
    }

    // Only owner can delete
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only workspace owner can delete');
    }

    await this.workspaceRepository.remove(workspace);
  }

  // Team management methods
  async isUserMemberOfWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { userId, workspaceId, acceptedAt: Not(IsNull()) },
    });
    return !!member;
  }

  async getUserRole(userId: string, workspaceId: string): Promise<WorkspaceMemberRole | null> {
    const member = await this.memberRepository.findOne({
      where: { userId, workspaceId, acceptedAt: Not(IsNull()) },
    });
    return member ? member.role : null;
  }

  async inviteMember(workspaceId: string, inviterId: string, email: string, role: WorkspaceMemberRole = WorkspaceMemberRole.MEMBER): Promise<WorkspaceMember> {
    // Check if inviter has permission
    const inviterRole = await this.getUserRole(inviterId, workspaceId);
    if (!inviterRole || (inviterRole === WorkspaceMemberRole.MEMBER)) {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    // Check workspace subscription allows team members
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: ['subscription'],
    });

    if (workspace.subscription.planType !== SubscriptionPlan.TEAM) {
      throw new ForbiddenException('Team plan required to invite members');
    }

    // Check if already invited
    const existingMember = await this.memberRepository.findOne({
      where: { workspaceId, inviteEmail: email },
    });

    if (existingMember) {
      throw new BadRequestException('User already invited');
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    const member = this.memberRepository.create({
      workspaceId,
      inviteEmail: email,
      inviteToken,
      invitedBy: inviterId,
      invitedAt: new Date(),
      role,
    });

    return this.memberRepository.save(member);
  }

  async acceptInvite(inviteToken: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { inviteToken },
      relations: ['workspace'],
    });

    if (!member) {
      throw new NotFoundException('Invalid invite token');
    }

    // Update member with user ID and acceptance
    member.userId = userId;
    member.acceptedAt = new Date();
    member.inviteToken = null; // Clear token after use

    await this.memberRepository.save(member);
  }

  async removeMember(workspaceId: string, requesterId: string, memberId: string): Promise<void> {
    // Check requester permission
    const requesterRole = await this.getUserRole(requesterId, workspaceId);
    if (!requesterRole || requesterRole === WorkspaceMemberRole.MEMBER) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }

    // Prevent removing owner
    const memberToRemove = await this.memberRepository.findOne({
      where: { workspaceId, userId: memberId },
    });

    if (!memberToRemove) {
      throw new NotFoundException('Member not found');
    }

    if (memberToRemove.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove workspace owner');
    }

    await this.memberRepository.remove(memberToRemove);
  }

  async updateMemberRole(workspaceId: string, requesterId: string, memberId: string, newRole: WorkspaceMemberRole): Promise<void> {
    // Only owner can change roles
    const requesterRole = await this.getUserRole(requesterId, workspaceId);
    if (requesterRole !== WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Only owner can change member roles');
    }

    const member = await this.memberRepository.findOne({
      where: { workspaceId, userId: memberId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change owner role
    if (member.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot change owner role');
    }

    member.role = newRole;
    await this.memberRepository.save(member);
  }

  async getMembers(workspaceId: string, userId: string): Promise<WorkspaceMember[]> {
    // Check if user has access
    const isMember = await this.isUserMemberOfWorkspace(userId, workspaceId);
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    return this.memberRepository.find({
      where: { workspaceId },
      relations: ['user', 'inviter'],
      order: { createdAt: 'ASC' },
    });
  }
}