import { Workspace } from '../../api/src/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../../api/src/workspaces/entities/workspace-member.entity';

export interface CreateWorkspaceData {
  name: string;
  description?: string;
  isPersonal?: boolean;
  ownerId?: string;
}

export interface CreateWorkspaceMemberData {
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt?: Date;
}

export class WorkspaceFixtures {
  static createWorkspaceData(overrides: Partial<CreateWorkspaceData> = {}): CreateWorkspaceData {
    const defaults: CreateWorkspaceData = {
      name: `Test Workspace ${Date.now()}`,
      description: 'A test workspace for integration testing',
      isPersonal: false,
    };

    return { ...defaults, ...overrides };
  }

  static createWorkspaceMemberData(overrides: Partial<CreateWorkspaceMemberData> = {}): CreateWorkspaceMemberData {
    const defaults: CreateWorkspaceMemberData = {
      workspaceId: '',
      userId: '',
      role: 'MEMBER',
      joinedAt: new Date(),
    };

    return { ...defaults, ...overrides };
  }

  // Predefined workspace fixtures
  static readonly PERSONAL_WORKSPACE = {
    name: 'Personal Workspace',
    description: 'Personal workspace for individual use',
    isPersonal: true,
  };

  static readonly TEAM_WORKSPACE = {
    name: 'Team Workspace',
    description: 'Collaborative workspace for team projects',
    isPersonal: false,
  };

  static readonly ENTERPRISE_WORKSPACE = {
    name: 'Enterprise Workspace',
    description: 'Large scale enterprise workspace',
    isPersonal: false,
  };

  static readonly ARCHIVE_WORKSPACE = {
    name: 'Archived Workspace',
    description: 'This workspace has been archived',
    isPersonal: false,
  };

  // Validation test data
  static readonly EMPTY_NAME_WORKSPACE = {
    name: '',
    description: 'Workspace with empty name',
    isPersonal: false,
  };

  static readonly LONG_NAME_WORKSPACE = {
    name: 'A'.repeat(256), // Assuming max length is 255
    description: 'Workspace with very long name',
    isPersonal: false,
  };

  static readonly LONG_DESCRIPTION_WORKSPACE = {
    name: 'Long Description Workspace',
    description: 'A'.repeat(1001), // Assuming max length is 1000
    isPersonal: false,
  };

  // Member role fixtures
  static readonly OWNER_MEMBER = {
    role: 'OWNER' as const,
  };

  static readonly ADMIN_MEMBER = {
    role: 'ADMIN' as const,
  };

  static readonly MEMBER_MEMBER = {
    role: 'MEMBER' as const,
  };

  static readonly VIEWER_MEMBER = {
    role: 'VIEWER' as const,
  };

  // Batch creation helpers
  static createMultipleWorkspaces(count: number, ownerId: string): CreateWorkspaceData[] {
    const workspaces: CreateWorkspaceData[] = [];
    
    for (let i = 0; i < count; i++) {
      workspaces.push(this.createWorkspaceData({
        name: `Workspace ${i}`,
        description: `Test workspace number ${i}`,
        ownerId,
      }));
    }

    return workspaces;
  }

  static createWorkspaceWithMembers(
    workspaceData: CreateWorkspaceData,
    memberUserIds: string[],
    roles: Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'> = []
  ): {
    workspace: CreateWorkspaceData;
    members: CreateWorkspaceMemberData[];
  } {
    const members: CreateWorkspaceMemberData[] = memberUserIds.map((userId, index) => ({
      workspaceId: '', // Will be set after workspace creation
      userId,
      role: roles[index] || 'MEMBER',
      joinedAt: new Date(),
    }));

    return {
      workspace: workspaceData,
      members,
    };
  }

  static createWorkspaceHierarchy(ownerId: string): {
    personalWorkspace: CreateWorkspaceData;
    teamWorkspaces: CreateWorkspaceData[];
    enterpriseWorkspace: CreateWorkspaceData;
  } {
    return {
      personalWorkspace: this.createWorkspaceData({
        ...this.PERSONAL_WORKSPACE,
        ownerId,
      }),
      teamWorkspaces: this.createMultipleWorkspaces(3, ownerId),
      enterpriseWorkspace: this.createWorkspaceData({
        ...this.ENTERPRISE_WORKSPACE,
        ownerId,
      }),
    };
  }
}