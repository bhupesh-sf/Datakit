import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Database,
  Package,
  Braces,
  Cloud,
  MoreVertical,
  Trash2,
  Edit2,
  Plus,
  TableProperties
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFolderStore } from '@/store/folderStore';
import { useAppStore } from '@/store/appStore';
import { useDuckDBStore } from '@/store/duckDBStore';
import { FolderNode, FileType, DraggedNode } from '@/types/folder';
import { cn } from '@/lib/utils';

interface FolderTreeViewProps {
  onFileSelect?: (node: FolderNode) => void;
  onFolderSelect?: (node: FolderNode) => void;
  className?: string;
}

export const FolderTreeView: React.FC<FolderTreeViewProps> = ({
  onFileSelect,
  onFolderSelect,
  className,
}) => {
  const { t } = useTranslation();
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  
  const draggedNodeRef = useRef<DraggedNode | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    roots,
    expandedIds,
    selectedIds,
    toggleFolder,
    selectNode,
    removeNode,
    renameNode,
    moveNode,
    createFolder,
    getNodeById
  } = useFolderStore();
  
  const { removeFile, removeFileFromWorkspace, workspaceFiles, files, activeFileId } = useAppStore();
  const { dropTable } = useDuckDBStore();

  // Comprehensive file deletion handler
  const handleDeleteNode = useCallback(async (node: FolderNode) => {
    console.log('[FolderTreeView] Deleting node:', node.name, node.type);
    
    try {
      if (node.type === 'file') {
        // 1. Find and close file tab if open
        const openFile = files.find(f => f.fileName === node.name);
        if (openFile) {
          console.log('[FolderTreeView] Removing file from app store:', openFile.id);
          removeFile(openFile.id);
        }
        
        // 2. Remove from workspace files (IndexedDB persistence)
        const workspaceFile = workspaceFiles.find(f => f.name === node.name);
        if (workspaceFile) {
          console.log('[FolderTreeView] Removing workspace file:', workspaceFile.id);
          removeFileFromWorkspace(workspaceFile.id);
        }
        
        // 3. Drop DuckDB table if it exists
        if (node.fileData?.tableName) {
          console.log('[FolderTreeView] Dropping DuckDB table:', node.fileData.tableName);
          try {
            await dropTable(node.fileData.tableName);
          } catch (dbError) {
            console.warn('[FolderTreeView] Failed to drop table:', dbError);
            // Continue with deletion even if table drop fails
          }
        }
      }
      
      // 4. Remove from folder store (tree view)
      console.log('[FolderTreeView] Removing node from folder store:', node.id);
      removeNode(node.id);
      
      console.log('[FolderTreeView] Successfully deleted:', node.name);
    } catch (error) {
      console.error('[FolderTreeView] Error during deletion:', error);
      // Still try to remove from folder store even if other cleanups fail
      removeNode(node.id);
    }
  }, [files, workspaceFiles, removeFile, removeFileFromWorkspace, dropTable, removeNode]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuNodeId && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuNodeId(null);
      }
    };

    if (contextMenuNodeId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contextMenuNodeId]);


  // Get file icon based on type
  const getFileIcon = (fileType?: FileType) => {
    const iconProps = { size: 16, strokeWidth: 1.5 };

    switch (fileType) {
      case 'csv':
      case 'excel':
        return <FileSpreadsheet {...iconProps} className="text-emerald-400" />;
      case 'json':
        return <Braces {...iconProps} className="text-amber-400" />;
      case 'parquet':
        return <Package {...iconProps} className="text-cyan-400" />;
      case 'txt':
        return <FileText {...iconProps} className="text-slate-400" />;
      case 'duckdb':
        return <Database {...iconProps} className="text-violet-400" />;
      case 'remote':
        return <Cloud {...iconProps} className="text-blue-400" />;
      case 'query':
        return <TableProperties {...iconProps} className="text-orange-400" />;
      default:
        return <FileText {...iconProps} className="text-white/50" />;
    }
  };

  // TODO: Do we neeed this?
  //
  // Get loading status icon
  // const getLoadingIcon = (isLoaded?: boolean) => {
  //   if (isLoaded === undefined) return null;
  //   if (isLoaded) {
  //     return <CheckCircle size={12} className="text-green-400" />;
  //   }
  //   return <Circle size={12} className="text-white/30" />;
  // };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1)
    return size !== '0' ? `${size} ${sizes[i]}` : '';
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, node: FolderNode) => {
    draggedNodeRef.current = {
      nodeId: node.id,
      type: node.type,
      parentId: node.parentId,
    };
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, targetNode: FolderNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (targetNode.type === 'folder' && draggedNodeRef.current?.nodeId !== targetNode.id) {
      e.dataTransfer.dropEffect = 'move';
      setDraggedOver(targetNode.id);
    }
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOver(null);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetNode: FolderNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedNode = draggedNodeRef.current;
    if (draggedNode && targetNode.type === 'folder' && draggedNode.nodeId !== targetNode.id) {
      // Don't allow dropping a folder into its own descendant
      let parent = getNodeById(targetNode.id);
      let canDrop = true;
      
      while (parent) {
        if (parent.id === draggedNode.nodeId) {
          canDrop = false;
          break;
        }
        parent = parent.parentId ? getNodeById(parent.parentId) : undefined;
      }
      
      if (canDrop) {
        moveNode(draggedNode.nodeId, targetNode.id);
      }
    }
    
    setDraggedOver(null);
    draggedNodeRef.current = null;
  };

  // Handle file/folder selection
  const handleNodeClick = (node: FolderNode, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Close any open context menu when clicking on a different node
    if (contextMenuNodeId && contextMenuNodeId !== node.id) {
      setContextMenuNodeId(null);
    }
    
    if (node.type === 'folder') {
      toggleFolder(node.id);
      onFolderSelect?.(node);
    } else {
      onFileSelect?.(node);
    }
    
    selectNode(node.id, e.metaKey || e.ctrlKey);
  };

  // Handle right-click to show context menu
  const handleNodeContextMenu = (node: FolderNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Show context menu on right-click
    setContextMenuNodeId(node.id);
    
    // Also select the node when right-clicking
    selectNode(node.id, e.metaKey || e.ctrlKey);
  };

  // Start renaming
  const handleStartRename = (node: FolderNode) => {
    setRenamingNodeId(node.id);
    setNewName(node.name);
    setContextMenuNodeId(null);
  };

  // Confirm rename
  const handleConfirmRename = (nodeId: string) => {
    if (newName.trim()) {
      renameNode(nodeId, newName.trim());
    }
    setRenamingNodeId(null);
    setNewName('');
  };

  // Start creating folder
  const handleStartCreateFolder = (parentId: string | null) => {
    setCreatingFolderIn(parentId || 'root');
    setNewFolderName('New Folder');
    setContextMenuNodeId(null);
  };

  // Confirm create folder
  const handleConfirmCreateFolder = () => {
    if (newFolderName.trim()) {
      const parentId = creatingFolderIn === 'root' ? null : creatingFolderIn;
      createFolder(newFolderName.trim(), parentId);
    }
    setCreatingFolderIn(null);
    setNewFolderName('');
  };

  // Check if this node corresponds to the active file
  const isActiveFile = (node: FolderNode): boolean => {
    if (node.type !== 'file' || !activeFileId) return false;
    
    // Find the active file in the app store
    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) return false;
    
    // Match by file name
    return node.name === activeFile.fileName;
  };

  // Render tree node
  const renderNode = (node: FolderNode, depth = 0, isLast = false, parentConnections: boolean[] = []) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIds.has(node.id);
    const isDraggedOver = draggedOver === node.id;
    const isRenaming = renamingNodeId === node.id;
    const hasContextMenu = contextMenuNodeId === node.id;
    const isActive = isActiveFile(node);

    return (
      <div key={node.id} className="relative overflow-visible">
        {/* Simplified connection lines - complex for folders, simple for files */}
        {depth > 0 && node.type === 'folder' && (
          <div className="absolute left-0 top-0 h-full flex">
            {/* Draw parent connections */}
            {parentConnections.map((hasConnection, index) => (
              <div key={index} className="w-4 flex justify-center">
                {hasConnection && (
                  <div className="w-px h-full bg-white/8" />
                )}
              </div>
            ))}
            
            {/* Draw current level connection */}
            <div className="w-4 flex justify-center relative">
              {/* Single unified vertical line */}
              <div className="absolute top-0 w-px bg-white/8" style={{ height: isLast ? '16px' : '100%' }} />
            </div>
          </div>
        )}
        
        {/* Simple left border for files - aligned with folder connection lines */}
        {depth > 0 && node.type === 'file' && (
          <div className="absolute w-px h-full bg-white/8" style={{ left: `${(depth - 1) * 16 + 8}px` }} />
        )}
        
        <div
          className={cn(
            'group flex items-center gap-1 py-1.5 cursor-pointer transition-all relative',
            isActive && node.type === 'file' && 'bg-primary/20 border-l-2 border-primary z-10',
            isSelected && !isActive && 'bg-white/5',
            !isSelected && !isActive && 'hover:bg-white/5',
            isDraggedOver && 'bg-primary/20 ring-1 ring-primary',
            // Non-active files
            node.type === 'file' && !isActive && 'ml-0.5',
          )}
          style={{ 
            paddingLeft: `${6 + depth * 20 + (node.type === 'file' ? 12 : 0) - (isActive ? 2 : 0)}px`,
            paddingRight: isActive && node.type === 'file' ? '12px' : '8px'
          }}
          onClick={(e) => handleNodeClick(node, e)}
          onContextMenu={(e) => handleNodeContextMenu(node, e)}
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
        >
          {/* Active file border cover - hides the sidebar border just for this row */}
          {isActive && node.type === 'file' && (
            <div 
              className="absolute top-0 -right-2 w-4 h-full bg-darkNav z-20"
            />
          )}
          {/* Expand/collapse chevron for folders */}
          {node.type === 'folder' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              className="p-0.5 hover:bg-white/10 rounded"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-white/60" />
              ) : (
                <ChevronRight size={14} className="text-white/60" />
              )}
            </button>
          )}

          {/* Icon with enhanced spacing for files */}
          <div className={cn(
            "flex-shrink-0",
            node.type === 'file' && "ml-1"
          )}>
            {node.type === 'folder' ? (
              isExpanded ? (
                <FolderOpen size={16} className="text-primary/70" />
              ) : (
                <Folder size={16} className="text-primary/70" />
              )
            ) : (
              <div className="flex items-center gap-1">
                {getFileIcon(node.fileData?.fileType)}
              </div>
            )}
          </div>

          {/* Name or rename input */}
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename(node.id);
                if (e.key === 'Escape') {
                  setRenamingNodeId(null);
                  setNewName('');
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => handleConfirmRename(node.id)}
              className="flex-1 bg-white/10 border border-white/20 rounded px-1 py-0 text-xs text-white outline-none focus:border-primary"
              autoFocus
            />
          ) : (
            <>
              <span
                className={cn(
                  'flex-1 text-xs truncate',
                  node.fileData?.isLoaded === false && 'opacity-50',
                  // Enhanced text styling for files
                  isActive && 'text-white font-medium',
                  node.type === 'file' && !isActive && 'text-white/80 font-normal',
                  node.type === 'folder' && 'text-white font-medium'
                )}
              >
                {node.name}
              </span>

              {/* File metadata */}
              {node.type === 'file' && (
                <>
                  {/* {getLoadingIcon(node.fileData?.isLoaded)} */}
                  {/* Show draft badge for query results */}
                  {node.fileData?.fileType === 'query' && (
                    <span className="text-[10px] text-orange-400 bg-orange-400/10 px-1 rounded border border-orange-400/20">
                      Draft
                    </span>
                  )}
                  {node.fileData?.size && node.fileData.size > 0 && (
                    <span className="text-[10px] text-white/40">
                      {formatFileSize(node.fileData.size)}
                    </span>
                  )}
                </>
              )}

              {/* Special folder badges */}
              {node.folderData?.isDraft && (
                <span className="text-[10px] text-white/40 bg-white/10 px-1 rounded">
                  Draft
                </span>
              )}
              {node.folderData?.isLinked && (
                <span className="text-[10px] text-blue-400/60">
                  Linked
                </span>
              )}

              {/* Context menu button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuNodeId(hasContextMenu ? null : node.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-opacity"
              >
                <MoreVertical size={14} className="text-white/60" />
              </button>
            </>
          )}
        </div>

        {/* Context menu */}
        <AnimatePresence>
          {hasContextMenu && (
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-4 bg-black border border-white/15 rounded-md shadow-xl overflow-hidden z-50 min-w-[140px]"
              onMouseLeave={() => setContextMenuNodeId(null)}
            >
              {node.type === 'folder' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartCreateFolder(node.id);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 w-full text-left text-xs"
                >
                  <Plus size={14} />
                  New Folder
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(node);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 w-full text-left text-xs"
              >
                <Edit2 size={14} />
                Rename
              </button>
              {!node.folderData?.isDraft && !node.folderData?.isRemote && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${node.name}"?`)) {
                      handleDeleteNode(node);
                    }
                    setContextMenuNodeId(null);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 w-full text-left text-xs text-red-400"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Children */}
        {node.type === 'folder' && isExpanded && (
          <>
            {/* New folder input */}
            {creatingFolderIn === node.id && (
              <div 
                className="flex items-center gap-1 py-1"
                style={{ paddingLeft: `${8 + (depth + 1) * 20}px`, paddingRight: '8px' }}
              >
                <Folder size={16} className="text-primary/70" />
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCreateFolder();
                    if (e.key === 'Escape') {
                      setCreatingFolderIn(null);
                      setNewFolderName('');
                    }
                  }}
                  onBlur={handleConfirmCreateFolder}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-1 py-0 text-xs text-white outline-none focus:border-primary"
                  autoFocus
                />
              </div>
            )}
            
            {/* Child nodes */}
            {node.children?.map((child, index) => {
              const isLastChild = index === (node.children?.length || 0) - 1;
              const newParentConnections = [...parentConnections, !isLast];
              return renderNode(child, depth + 1, isLastChild, newParentConnections);
            })}
            
            {/* Empty folder message */}
            {(!node.children || node.children.length === 0) && creatingFolderIn !== node.id && (
              <div 
                className="py-2 text-[10px] text-white/30 italic"
                style={{ paddingLeft: `${8 + (depth + 1) * 20 + 12}px`, paddingRight: '8px' }}
              >
                {node.folderData?.isDraft
                  ? 'Drag files here to organize'
                  : 'Empty folder'}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Handle clicks on empty space to close context menu
  const handleContainerClick = (e: React.MouseEvent) => {
    // Only close if clicking on the container itself, not on its children
    if (e.target === e.currentTarget && contextMenuNodeId) {
      setContextMenuNodeId(null);
    }
  };

  return (
    <div className={cn('py-2', className)} onClick={handleContainerClick}>
      {/* Create root folder input */}
      {creatingFolderIn === 'root' && (
        <div className="flex items-center gap-1 px-2 py-1 mb-1">
          <Folder size={16} className="text-primary/70" />
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreateFolder();
              if (e.key === 'Escape') {
                setCreatingFolderIn(null);
                setNewFolderName('');
              }
            }}
            onBlur={handleConfirmCreateFolder}
            className="flex-1 bg-white/10 border border-white/20 rounded px-1 py-0 text-xs text-white outline-none focus:border-primary"
            autoFocus
          />
        </div>
      )}

      {/* Tree nodes */}
      <div className="space-y-0.5 overflow-visible">
        {roots.map((node, index) => {
          const isLastRoot = index === roots.length - 1;
          return renderNode(node, 0, isLastRoot, []);
        })}
      </div>

      {/* Empty state */}
      {roots.length === 0 && (
        <div className="px-4 py-8 text-center">
          <Folder className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-xs text-white/40">No files or folders</p>
          <p className="text-[10px] text-white/30 mt-1">
            Click "New Folder" above to get started
          </p>
        </div>
      )}
    </div>
  );
};