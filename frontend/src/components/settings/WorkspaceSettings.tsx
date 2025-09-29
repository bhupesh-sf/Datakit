import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import {
  Users,
  Crown,
  Shield,
  User,
  Mail,
  Trash2,
  UserPlus,
  Settings as SettingsIcon,
  Edit3,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { WorkspaceMember, WorkspaceInvite } from "@/types/workspace";

const WorkspaceSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user, currentWorkspace, loadCurrentWorkspace } = useAuthStore();
  const {
    workspaces,
    currentWorkspaceMembers,
    isLoadingMembers,
    loadWorkspaces,
    loadMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    getCurrentUserRole,
    updateWorkspace,
  } = useWorkspaceStore();

  // Debug logging
  console.log("WorkspaceSettings Debug:", {
    user,
    currentWorkspace,
    workspaces,
    userCurrentWorkspaceId: user?.currentWorkspaceId,
  });

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Fallback: use first workspace if currentWorkspace is not set
  const displayWorkspace = currentWorkspace || workspaces[0];

  const userRole = getCurrentUserRole(user?.id || "", displayWorkspace?.id);
  const canManageTeam = userRole === "owner" || userRole === "admin";
  const isTeamPlan = displayWorkspace?.subscription?.planType === "team";
  const isProOrTeam =
    displayWorkspace?.subscription?.planType === "pro" ||
    displayWorkspace?.subscription?.planType === "team";
  const canEditWorkspace = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    // Load workspaces first if not loaded
    if (workspaces.length === 0) {
      console.log("Loading workspaces...");
      loadWorkspaces();
    }

    // Try to load current workspace if not already loaded
    if (user?.currentWorkspaceId && !currentWorkspace) {
      console.log("Loading current workspace...");
      loadCurrentWorkspace();
    }

    if (displayWorkspace?.id) {
      loadMembers(displayWorkspace.id);
    }
  }, [
    displayWorkspace?.id,
    user?.currentWorkspaceId,
    loadMembers,
    loadCurrentWorkspace,
    currentWorkspace,
    workspaces.length,
    loadWorkspaces,
  ]);

  // Set workspace name when displayWorkspace changes
  useEffect(() => {
    if (displayWorkspace?.name) {
      setWorkspaceName(displayWorkspace.name);
    }
  }, [displayWorkspace?.name]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayWorkspace?.id) return;

    setIsInviting(true);
    try {
      await inviteMember(displayWorkspace.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setShowInviteForm(false);
    } catch (error) {
      console.error("Failed to invite member:", error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!displayWorkspace?.id) return;

    try {
      await removeMember(displayWorkspace.id, memberId);
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  const handleUpdateRole = async (
    memberId: string,
    newRole: "admin" | "member"
  ) => {
    if (!displayWorkspace?.id) return;

    try {
      await updateMemberRole(displayWorkspace.id, memberId, newRole);
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleUpdateWorkspaceName = async () => {
    if (!displayWorkspace?.id || !workspaceName.trim()) return;

    setIsUpdatingName(true);
    try {
      await updateWorkspace(displayWorkspace.id, {
        name: workspaceName.trim(),
      });
      setIsEditingName(false);
      // Reload current workspace to reflect changes
      await loadCurrentWorkspace();
    } catch (error) {
      console.error("Failed to update workspace name:", error);
      // Reset to original name on error
      setWorkspaceName(displayWorkspace.name);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleCancelEdit = () => {
    setWorkspaceName(displayWorkspace?.name || "");
    setIsEditingName(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-yellow-400" />;
      case "admin":
        return <Shield className="h-4 w-4 text-blue-400" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case "owner":
        return t('settings.workspace.roles.owner', { defaultValue: 'Owner' });
      case "admin":
        return t('settings.workspace.roles.admin', { defaultValue: 'Admin' });
      default:
        return t('settings.workspace.roles.member', { defaultValue: 'Member' });
    }
  };

  if (!user) {
    return (
      <div className="text-center text-white/60 py-8">
        <SettingsIcon className="h-12 w-12 mx-auto mb-4 text-white/40" />
        <p>{t('settings.workspace.loading.userData', { defaultValue: 'Loading user data...' })}</p>
      </div>
    );
  }

  if (!displayWorkspace && workspaces.length === 0) {
    return (
      <div className="text-center text-white/60 py-8">
        <SettingsIcon className="h-12 w-12 mx-auto mb-4 text-white/40" />
        <p>{t('settings.workspace.loading.workspaces', { defaultValue: 'Loading workspaces...' })}</p>
      </div>
    );
  }

  if (!displayWorkspace) {
    return (
      <div className="text-center text-white/60 py-8">
        <SettingsIcon className="h-12 w-12 mx-auto mb-4 text-white/40" />
        <p>{t('settings.workspace.noWorkspace', { defaultValue: 'No workspace found. Please create a workspace or contact support.' })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Info */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            {/* Workspace Name - Editable for Pro/Team users */}
            <div className="flex items-center gap-2 mb-2">
              {isEditingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="flex-1 px-3 py-1 bg-white/5 border border-white/20 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
                    placeholder={t('settings.workspace.workspaceName.placeholder', { defaultValue: 'Workspace name' })}
                    maxLength={50}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateWorkspaceName();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  <button
                    onClick={handleUpdateWorkspaceName}
                    disabled={isUpdatingName || !workspaceName.trim()}
                    className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isUpdatingName}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <h4 className="text-lg font-medium text-white">
                    {displayWorkspace.name}
                  </h4>

                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-1 text-white/40 hover:text-white/80 transition-colors"
                    title={t('settings.workspace.workspaceName.editTitle', { defaultValue: 'Edit workspace name' })}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-white/60">
              {displayWorkspace.description || t('settings.workspace.personalWorkspace', { defaultValue: 'Personal workspace' })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {displayWorkspace.subscription?.planType?.toUpperCase() || "FREE"}
            </div>
            <div className="text-xs text-white/60">
              {displayWorkspace.subscription?.creditsRemaining === -1
                ? t('settings.workspace.unlimitedCredits', { defaultValue: 'Unlimited credits' })
                : t('settings.workspace.creditsRemaining', { defaultValue: '{count} credits remaining', count: displayWorkspace.subscription?.creditsRemaining || 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Team Plan Upgrade Prompt */}
      {/* {!isTeamPlan && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <div className="text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-blue-400" />
            <h4 className="text-lg font-medium text-white mb-2">Unlock Team Collaboration</h4>
            <p className="text-white/70 mb-4">
              Upgrade to the Team plan to invite team members, share workspaces, and collaborate on data analysis projects.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
              <div className="text-sm text-white/80 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                  <span>Invite unlimited team members</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                  <span>Role-based permissions (Owner, Admin, Member)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                  <span>Unlimited DataKit AI credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                  <span>Shared workspace resources</span>
                </div>
              </div>
            </div>
            <Button variant="primary" className="w-full">
              Upgrade to Team Plan - $49/month
            </Button>
          </div>
        </div>
      )} */}

      {/* Team Management - Only show for Team plans */}
      {isTeamPlan && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('settings.workspace.teamMembers.title', { defaultValue: 'Team Members' })}
            </h4>

            {canManageTeam && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {t('settings.workspace.teamMembers.inviteMember', { defaultValue: 'Invite Member' })}
              </Button>
            )}
          </div>

          {/* Invite Form */}
          {showInviteForm && canManageTeam && (
            <form
              onSubmit={handleInviteMember}
              className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4"
            >
              <h5 className="text-sm font-medium text-white mb-3">
                {t('settings.workspace.inviteForm.title', { defaultValue: 'Invite New Member' })}
              </h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    {t('settings.workspace.inviteForm.emailLabel', { defaultValue: 'Email Address' })}
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
                    placeholder={t('settings.workspace.inviteForm.emailPlaceholder', { defaultValue: 'Enter email address' })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1">
                    {t('settings.workspace.inviteForm.roleLabel', { defaultValue: 'Role' })}
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "admin" | "member")
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-white focus:outline-none focus:border-primary/50"
                  >
                    <option value="member">{t('settings.workspace.roles.member', { defaultValue: 'Member' })}</option>
                    <option value="admin">{t('settings.workspace.roles.admin', { defaultValue: 'Admin' })}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isInviting}
                  >
                    {isInviting ? t('settings.workspace.inviteForm.sending', { defaultValue: 'Sending...' }) : t('settings.workspace.inviteForm.sendInvite', { defaultValue: 'Send Invite' })}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInviteForm(false)}
                  >
                    {t('settings.workspace.inviteForm.cancel', { defaultValue: 'Cancel' })}
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* Members List */}
          {isLoadingMembers ? (
            <div className="text-center text-white/60 py-4">
              {t('settings.workspace.loading.members', { defaultValue: 'Loading members...' })}
            </div>
          ) : (
            <div className="space-y-2">
              {currentWorkspaceMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-xs font-medium text-white">
                      {member.user?.name?.charAt(0) ||
                        member.user?.email.charAt(0) ||
                        "?"}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {member.user?.name || t('settings.workspace.unknownUser', { defaultValue: 'Unknown User' })}
                      </div>
                      <div className="text-xs text-white/60 flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {member.user?.email || member.inviteEmail}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      {getRoleIcon(member.role)}
                      <span className="text-white/80">
                        {getRoleName(member.role)}
                      </span>
                    </div>

                    {canManageTeam &&
                      member.role !== "owner" &&
                      member.userId !== user?.id && (
                        <div className="flex items-center gap-1">
                          {userRole === "owner" && (
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleUpdateRole(
                                  member.id,
                                  e.target.value as "admin" | "member"
                                )
                              }
                              className="text-xs bg-white/5 border border-white/20 rounded px-2 py-1 text-white"
                            >
                              <option value="member">{t('settings.workspace.roles.member', { defaultValue: 'Member' })}</option>
                              <option value="admin">{t('settings.workspace.roles.admin', { defaultValue: 'Admin' })}</option>
                            </select>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSettings;
