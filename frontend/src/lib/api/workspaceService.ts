import { apiClient } from "./apiClient";
import {
  Workspace,
  WorkspaceMember,
  CreateWorkspaceData,
  UpdateWorkspaceData,
  WorkspaceInvite,
} from "@/types/workspace";

export const workspaceService = {
  // Get all workspaces for the current user
  async getWorkspaces(): Promise<Workspace[]> {
    return await apiClient.get<Workspace[]>("/workspaces");
  },

  // Get a specific workspace
  async getWorkspace(id: string): Promise<Workspace> {
    return await apiClient.get<Workspace>(`/workspaces/${id}`);
  },

  // Create a new workspace
  async createWorkspace(data: CreateWorkspaceData): Promise<Workspace> {
    return await apiClient.post<Workspace>("/workspaces", data);
  },

  // Update workspace details
  async updateWorkspace(
    id: string,
    data: UpdateWorkspaceData
  ): Promise<Workspace> {
    return await apiClient.patch<Workspace>(
      `/workspaces/${id}`,
      data
    );
  },

  // Switch to a different workspace
  async switchWorkspace(id: string): Promise<void> {
    await apiClient.post(`/workspaces/${id}/switch`);
  },

  // Delete a workspace
  async deleteWorkspace(id: string): Promise<void> {
    await apiClient.delete(`/workspaces/${id}`);
  },

  // Team management
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return await apiClient.get<WorkspaceMember[]>(
      `/workspaces/${workspaceId}/members`
    );
  },

  async inviteMember(
    workspaceId: string,
    invite: WorkspaceInvite
  ): Promise<WorkspaceMember> {
    return await apiClient.post<WorkspaceMember>(
      `/workspaces/${workspaceId}/members/invite`,
      invite
    );
  },

  async acceptInvite(token: string): Promise<void> {
    await apiClient.post("/workspaces/accept-invite", null, {
      params: { token },
    });
  },

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  },

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: "admin" | "member"
  ): Promise<void> {
    await apiClient.patch(
      `/workspaces/${workspaceId}/members/${memberId}/role`,
      { role }
    );
  },
};
