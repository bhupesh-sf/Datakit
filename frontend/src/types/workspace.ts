export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isPersonal: boolean;
  logoUrl?: string;
  subscription?: WorkspaceSubscription;
  members?: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSubscription {
  id: string;
  planType: 'free' | 'pro' | 'team';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  creditsRemaining: number;
  monthlyCredits: number;
  creditsResetAt?: string;
  currentPeriodEnd?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  };
  role: 'owner' | 'admin' | 'member';
  invitedBy?: string;
  inviter?: {
    id: string;
    name?: string;
    email: string;
  };
  inviteEmail?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceInvite {
  email: string;
  role: 'admin' | 'member';
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface UpdateWorkspaceData {
  name?: string;
  description?: string;
  logoUrl?: string;
}