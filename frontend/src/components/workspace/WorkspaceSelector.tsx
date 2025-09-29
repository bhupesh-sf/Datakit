import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  Plus,
  FolderOpen,
  Check,
  X,
  Edit2,
  Trash2,
  Save,
  HelpCircle,
  Shield,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/auth/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import AuthModal from '@/components/auth/AuthModal';

export const WorkspaceSelector: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveName, setDraftSaveName] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get workspace state from appStore
  const {
    workspaces,
    activeWorkspaceId,
    workspaceFiles,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    deleteWorkspace,
    saveDraftWorkspace,
  } = useAppStore();

  // Get authentication state
  const { isAuthenticated } = useAuth();
  
  // Get notifications
  const { showSuccess } = useNotifications();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // Calculate non-draft workspace count for limit checking
  const nonDraftWorkspaceCount = workspaces.filter((w) => !w.isDraft).length;

  // Calculate dropdown position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(320, rect.width), // Ensure at least 320px width
      });
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      updateDropdownPosition();
      // Update position on scroll/resize
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen]);

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) return;

    // Check workspace limit for non-authenticated users
    if (!isAuthenticated && nonDraftWorkspaceCount >= 1) {
      console.log(
        '[WorkspaceSelector] Workspace limit reached for non-authenticated user'
      );
      setShowAuthModal(true);
      return;
    }

    // Create workspace if under limit or authenticated
    const workspaceName = newWorkspaceName.trim();
    createWorkspace(workspaceName);
    
    // Show success notification
    showSuccess(
      t('workspace.selector.workspaceCreated'),
      t('workspace.selector.workspaceCreatedMessage', { name: workspaceName }),
      { icon: 'check', duration: 4000 }
    );
    
    setNewWorkspaceName('');
    setIsCreating(false);
    setIsOpen(false);
  };

  const handleRenameWorkspace = (id: string) => {
    if (editingName.trim()) {
      const oldName = workspaces.find(w => w.id === id)?.name;
      const newName = editingName.trim();
      
      renameWorkspace(id, newName);
      
      // Show success notification
      showSuccess(
        t('workspace.selector.workspaceRenamed'),
        t('workspace.selector.workspaceRenamedMessage', { oldName, newName }),
        { icon: 'check', duration: 4000 }
      );
      
      setEditingId(null);
    }
  };

  const handleDeleteWorkspace = (id: string) => {
    if (id === 'draft') return; // Can't delete draft

    const workspace = workspaces.find((w) => w.id === id);
    const confirmed = confirm(
      t('workspace.selector.deleteConfirmation', { name: workspace?.name })
    );
    if (confirmed && workspace) {
      deleteWorkspace(id);
      
      // Show success notification
      showSuccess(
        t('workspace.selector.workspaceDeleted'),
        t('workspace.selector.workspaceDeletedMessage', { name: workspace.name }),
        { icon: 'check', duration: 4000 }
      );
    }
  };

  const handleSwitchWorkspace = (id: string) => {
    switchWorkspace(id);
    setIsOpen(false);
  };

  const handleToggleDropdown = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  const handleSaveDraft = () => {
    if (!draftSaveName.trim()) return;

    // Check workspace limit for non-authenticated users
    // When saving draft, this would create a new non-draft workspace
    if (!isAuthenticated && nonDraftWorkspaceCount >= 1) {
      console.log('[WorkspaceSelector] Cannot save draft - workspace limit reached for non-authenticated user');
      setIsOpen(false);
      setShowAuthModal(true);
      return;
    }

    // Save draft if under limit or authenticated
    const workspaceName = draftSaveName.trim();
    const fileCount = workspaceFiles.length;
    
    saveDraftWorkspace(workspaceName);
    
    // Show success notification
    showSuccess(
      t('workspace.selector.workspaceSaved'),
      t('workspace.selector.workspaceSavedMessage', { 
        name: workspaceName, 
        count: fileCount,
        files: fileCount === 1 ? t('workspace.selector.file') : t('workspace.selector.files')
      }),
      { icon: 'check', duration: 5000 }
    );
    
    setDraftSaveName('');
    setIsSavingDraft(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Workspace Selector Button */}
      <button
        ref={buttonRef}
        onClick={handleToggleDropdown}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg transition-all duration-200 group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary/70" />
          <span className="text-sm font-medium text-white">
            {activeWorkspace?.name || t('workspace.selector.selectWorkspace')}
          </span>
          {activeWorkspace?.isDraft && (
            <span className="text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
              {t('workspace.selector.unsaved')}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Portal Dropdown Menu */}
      {isOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed bg-black border border-white/15 rounded-lg shadow-xl overflow-hidden z-50"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
            >
              {/* Header with explanation and help */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white tracking-wide">
                      {t('workspace.selector.workspaces')}
                    </h3>
                    {!isAuthenticated && nonDraftWorkspaceCount >= 1 && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-400/10 text-amber-400 rounded">
                        {nonDraftWorkspaceCount}/1
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <HelpCircle className="h-4 w-4 text-white/50" />
                    </button>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {showTooltip && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-stone-900 border border-white/20 rounded-lg p-3 text-xs text-white/80 shadow-xl z-50"
                        >
                          <div className="space-y-2">
                            <p>
                              <strong className="text-white">{t('workspace.selector.tooltip.workspaces')}</strong>{' '}
                              {t('workspace.selector.tooltip.organizeFiles')}
                            </p>
                            <p>
                              <strong className="text-primary">{t('workspace.selector.tooltip.draft')}:</strong>{' '}
                              {t('workspace.selector.tooltip.draftDescription')}
                            </p>
                            <p>
                              <strong className="text-white">{t('workspace.selector.tooltip.benefits')}:</strong>{' '}
                              {t('workspace.selector.tooltip.benefitsDescription')}
                            </p>
                            {!isAuthenticated && (
                              <p>
                                <strong className="text-amber-400">
                                  {t('workspace.selector.tooltip.limit')}:
                                </strong>{' '}
                                {t('workspace.selector.tooltip.limitDescription')}{' '}
                                <span className="text-primary">{t('workspace.selector.tooltip.signUp')}</span>{' '}
                                {t('workspace.selector.tooltip.unlimitedWorkspaces')}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  {t('workspace.selector.organizeDescription')}
                </p>
              </div>
              {/* Workspace List */}
              <div className="max-h-64 min-h-32 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={`group flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors ${
                      workspace.id === activeWorkspaceId ? 'bg-primary/10' : ''
                    }`}
                  >
                    {editingId === workspace.id ? (
                      // Edit mode
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')
                              handleRenameWorkspace(workspace.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white outline-none focus:border-primary"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameWorkspace(workspace.id)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <Check className="h-3 w-3 text-green-400" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <X className="h-3 w-3 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      // Normal mode
                      <>
                        <button
                          onClick={() => handleSwitchWorkspace(workspace.id)}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          <FolderOpen className="h-4 w-4 text-white/50" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white">
                                {workspace.name}
                              </span>
                              {workspace.isDraft && (
                                <span className="text-[10px] text-white/40">
                                  {t('workspace.selector.draft')}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-white/40">
                              {t('workspace.selector.fileCount', { 
                                count: workspace.files.length
                              })}
                            </div>
                          </div>
                          {workspace.id === activeWorkspaceId && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </button>

                        {/* Action buttons (only show on hover, not for draft) */}
                        {!workspace.isDraft && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingId(workspace.id);
                                setEditingName(workspace.name);
                              }}
                              className="p-1 hover:bg-white/10 rounded"
                            >
                              <Edit2 className="h-3 w-3 text-white/60" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteWorkspace(workspace.id)
                              }
                              className="p-1 hover:bg-white/10 rounded"
                            >
                              <Trash2 className="h-3 w-3 text-red-400/60" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Draft Workspace */}
              {activeWorkspace?.isDraft && activeWorkspace.files.length > 0 && (
                <div className="border-t border-white/10 p-2">
                  {isSavingDraft ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftSaveName}
                        onChange={(e) => setDraftSaveName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDraft();
                          if (e.key === 'Escape') {
                            setIsSavingDraft(false);
                            setDraftSaveName('');
                          }
                        }}
                        placeholder={t('workspace.selector.workspaceNamePlaceholder')}
                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveDraft}
                        className="p-1.5 hover:bg-white/10 rounded"
                      >
                        <Check className="h-4 w-4 text-green-400" />
                      </button>
                      <button
                        onClick={() => {
                          setIsSavingDraft(false);
                          setDraftSaveName('');
                        }}
                        className="p-1.5 hover:bg-white/10 rounded"
                      >
                        <X className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsSavingDraft(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Save className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-white">
                        {t('workspace.selector.saveDraftAsWorkspace')}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Create New Workspace */}
              <div className="border-t border-white/10 p-2">
                {isCreating ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateWorkspace();
                        if (e.key === 'Escape') {
                          setIsCreating(false);
                          setNewWorkspaceName('');
                        }
                      }}
                      placeholder={t('workspace.selector.workspaceNamePlaceholder')}
                      className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:border-primary"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateWorkspace}
                      className="p-1.5 hover:bg-white/10 rounded"
                    >
                      <Check className="h-4 w-4 text-green-400" />
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewWorkspaceName('');
                      }}
                      className="p-1.5 hover:bg-white/10 rounded"
                    >
                      <X className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      // Check workspace limit for non-authenticated users
                      if (!isAuthenticated && nonDraftWorkspaceCount >= 1) {
                        console.log(
                          '[WorkspaceSelector] Workspace limit reached, showing auth modal'
                        );
                        setShowAuthModal(true);
                        setIsOpen(false);
                        return;
                      }
                      setIsCreating(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="text-sm text-white">{t('workspace.selector.newWorkspace')}</span>
                    </div>
                    {/* Show premium indicator for non-authenticated users at limit */}
                    {!isAuthenticated && nonDraftWorkspaceCount >= 1 && (
                      <Shield className="h-4 w-4 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* Auth Modal for workspace limit */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="signup"
        onLoginSuccess={() => {
          setShowAuthModal(false);
          // After successful auth, allow workspace creation
          if (newWorkspaceName.trim()) {
            setIsCreating(true);
          }
        }}
      />
    </div>
  );
};
