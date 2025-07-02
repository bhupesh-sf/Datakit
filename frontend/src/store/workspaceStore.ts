import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  Workspace, 
  WorkspaceMember, 
  CreateWorkspaceData, 
  UpdateWorkspaceData,
  WorkspaceInvite 
} from '@/types/workspace';
import { workspaceService } from '@/lib/api/workspaceService';

interface WorkspaceState {
  // State
  workspaces: Workspace[];
  currentWorkspaceMembers: WorkspaceMember[];
  isLoading: boolean;
  isLoadingMembers: boolean;
  error: string | null;
  
  // Actions
  loadWorkspaces: () => Promise<void>;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  updateWorkspace: (id: string, data: UpdateWorkspaceData) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  
  // Team management
  loadMembers: (workspaceId: string) => Promise<void>;
  inviteMember: (workspaceId: string, invite: WorkspaceInvite) => Promise<void>;
  removeMember: (workspaceId: string, memberId: string) => Promise<void>;
  updateMemberRole: (workspaceId: string, memberId: string, role: 'admin' | 'member') => Promise<void>;
  acceptInvite: (token: string) => Promise<void>;
  
  // Helpers
  setError: (error: string | null) => void;
  clearError: () => void;
  getWorkspaceById: (id: string) => Workspace | undefined;
  getCurrentUserRole: (userId: string, workspaceId?: string) => 'owner' | 'admin' | 'member' | null;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    (set, get) => ({
      // Initial state
      workspaces: [],
      currentWorkspaceMembers: [],
      isLoading: false,
      isLoadingMembers: false,
      error: null,
      
      // Actions
      loadWorkspaces: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const workspaces = await workspaceService.getWorkspaces();
          set({ workspaces, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load workspaces',
            isLoading: false,
          });
        }
      },
      
      createWorkspace: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          const workspace = await workspaceService.createWorkspace(data);
          const { workspaces } = get();
          set({ 
            workspaces: [...workspaces, workspace],
            isLoading: false 
          });
          return workspace;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create workspace',
            isLoading: false,
          });
          throw error;
        }
      },
      
      updateWorkspace: async (id, data) => {
        set({ isLoading: true, error: null });
        
        try {
          const updatedWorkspace = await workspaceService.updateWorkspace(id, data);
          const { workspaces } = get();
          set({
            workspaces: workspaces.map(w => w.id === id ? updatedWorkspace : w),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update workspace',
            isLoading: false,
          });
          throw error;
        }
      },
      
      deleteWorkspace: async (id) => {
        set({ isLoading: true, error: null });
        
        try {
          await workspaceService.deleteWorkspace(id);
          const { workspaces } = get();
          set({
            workspaces: workspaces.filter(w => w.id !== id),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete workspace',
            isLoading: false,
          });
          throw error;
        }
      },
      
      // Team management
      loadMembers: async (workspaceId) => {
        set({ isLoadingMembers: true, error: null });
        
        try {
          const members = await workspaceService.getMembers(workspaceId);
          set({ currentWorkspaceMembers: members, isLoadingMembers: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load members',
            isLoadingMembers: false,
          });
        }
      },
      
      inviteMember: async (workspaceId, invite) => {
        try {
          const member = await workspaceService.inviteMember(workspaceId, invite);
          const { currentWorkspaceMembers } = get();
          set({
            currentWorkspaceMembers: [...currentWorkspaceMembers, member],
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to invite member',
          });
          throw error;
        }
      },
      
      removeMember: async (workspaceId, memberId) => {
        try {
          await workspaceService.removeMember(workspaceId, memberId);
          const { currentWorkspaceMembers } = get();
          set({
            currentWorkspaceMembers: currentWorkspaceMembers.filter(m => m.id !== memberId),
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to remove member',
          });
          throw error;
        }
      },
      
      updateMemberRole: async (workspaceId, memberId, role) => {
        try {
          await workspaceService.updateMemberRole(workspaceId, memberId, role);
          const { currentWorkspaceMembers } = get();
          set({
            currentWorkspaceMembers: currentWorkspaceMembers.map(m => 
              m.id === memberId ? { ...m, role } : m
            ),
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update member role',
          });
          throw error;
        }
      },
      
      acceptInvite: async (token) => {
        try {
          await workspaceService.acceptInvite(token);
          // Reload workspaces after accepting invite
          await get().loadWorkspaces();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to accept invite',
          });
          throw error;
        }
      },
      
      // Helpers
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      getWorkspaceById: (id) => {
        const { workspaces } = get();
        return workspaces.find(w => w.id === id);
      },
      
      getCurrentUserRole: (userId, workspaceId) => {
        const { workspaces, currentWorkspaceMembers } = get();
        
        if (workspaceId) {
          // Check specific workspace
          const workspace = workspaces.find(w => w.id === workspaceId);
          if (workspace?.ownerId === userId) return 'owner';
          
          const member = currentWorkspaceMembers.find(m => m.userId === userId);
          return member?.role || null;
        }
        
        // Default to checking first workspace
        const firstWorkspace = workspaces[0];
        if (firstWorkspace?.ownerId === userId) return 'owner';
        
        const member = currentWorkspaceMembers.find(m => m.userId === userId);
        return member?.role || null;
      },
    }),
    { name: 'WorkspaceStore' }
  )
);