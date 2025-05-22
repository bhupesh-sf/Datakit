import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  XCircle, 
  Users,
  FileText,
  Table,
  BarChart3,
  Plus,
  ChevronLeft,
  MoreHorizontal,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';
import { FileTab } from '@/types/multiFile';
import { DataSourceType } from '@/types/json';

interface FileTabsProps {
  tabs: FileTab[];
  onTabClick: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
  onCloseAll: () => void;
  onCloseOthers: (fileId: string) => void;
  onNewFile?: () => void;
  className?: string;
  maxVisibleTabs?: number;
}

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  fileId: string | null;
}

/**
 * Get the appropriate icon for a file type with better visual hierarchy
 */
const getFileIcon = (sourceType: DataSourceType, remoteProvider?: string, isActive: boolean = false) => {
  const iconClass = cn(
    "h-4 w-4 mr-2 flex-shrink-0 transition-colors duration-200",
    isActive ? "opacity-100" : "opacity-70"
  );
  
  if (remoteProvider === 'google_sheets') {
    return <GoogleSheetsIcon className={iconClass} />;
  }
  
  switch (sourceType) {
    case DataSourceType.JSON:
      return <BarChart3 className={cn(iconClass, "text-amber-400")} />;
    case DataSourceType.XLSX:
      return <Table className={cn(iconClass, "text-emerald-400")} />;
    case DataSourceType.PARQUET:
      return <Database className={cn(iconClass, "text-violet-400")} />;
    case DataSourceType.CSV:
    default:
      return <FileText className={cn(iconClass, "text-blue-400")} />;
  }
};

/**
 * Individual file tab component with enhanced UX
 */
const FileTabItem: React.FC<{
  tab: FileTab;
  onTabClick: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
  onContextMenu: (e: React.MouseEvent, fileId: string) => void;
  isOverflowing?: boolean;
}> = ({ tab, onTabClick, onTabClose, onContextMenu, isOverflowing = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Enhanced visual feedback for different states
  const getTabStyles = () => {
    if (tab.isActive) {
      return "border-primary bg-primary/10 text-white shadow-lg";
    }
    if (isHovered) {
      return "border-white/20 bg-white/8 text-white/95";
    }
    return "border-transparent text-white/70 hover:text-white/90";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{ 
        opacity: 1, 
        scale: isDragging ? 1.05 : 1, 
        y: 0,
        rotateX: isDragging ? 5 : 0
      }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ 
        duration: 0.2, 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }}
      className={cn(
        "group relative flex items-center h-11 px-3 py-2 border-b-2 transition-all duration-200 cursor-pointer select-none",
        "hover:bg-white/5 min-w-0 rounded-t-lg mx-0.5",
        isOverflowing ? "max-w-32" : "max-w-64",
        getTabStyles()
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onTabClick(tab.id)}
      onContextMenu={(e) => onContextMenu(e, tab.id)}
      // Drag and drop could be added here
      draggable
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
    >
      {/* File Icon with enhanced styling */}
      {getFileIcon(tab.sourceType, tab.remoteProvider, tab.isActive)}
      
      {/* File Name with better typography */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className={cn(
          "truncate text-sm font-medium transition-colors",
          tab.isActive ? "text-white" : "text-white/80"
        )}>
          {tab.fileName}
        </span>
        
        {/* Subtle file info - only show on hover or when active */}
        <AnimatePresence>
          {(isHovered || tab.isActive) && !isOverflowing && (
            <motion.span
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-white/50 truncate"
            >
            {tab.sourceType}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      
      {/* Status indicators */}
      <div className="flex items-center gap-1 ml-1">
        {/* Google Sheets Indicator */}
        {tab.hasGoogleSheetsMetadata && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 rounded-full bg-green-400 shadow-lg" 
            title="Google Sheets"
          />
        )}
        
        {/* Processing indicator (could show loading state) */}
        {/* <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-2 h-2 rounded-full bg-blue-400"
        /> */}
      </div>
      
      {/* Enhanced Close Button */}
      <motion.button
        initial={false}
        animate={{ 
          opacity: isHovered || tab.isActive ? 1 : 0,
          scale: isHovered || tab.isActive ? 1 : 0.8,
          rotate: isHovered ? 90 : 0
        }}
        whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.2)" }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => {
          e.stopPropagation();
          onTabClose(tab.id);
        }}
        className="ml-2 p-1 rounded-full text-white/60 hover:primary flex-shrink-0 transition-colors"
        title="Close file"
      >
        <X className="h-3 w-3" />
      </motion.button>
      
      {/* Active tab indicator */}
      {tab.isActive && (
        <motion.div
          layoutId="activeTabIndicator"
          className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </motion.div>
  );
};

/**
 * Enhanced Context menu with more options
 */
const ContextMenu: React.FC<{
  isOpen: boolean;
  position: { x: number; y: number };
  tab: FileTab | null;
  onClose: () => void;
  onCloseAll: () => void;
  onCloseOthers: () => void;
  onDuplicate?: (fileId: string) => void;
  onRename?: (fileId: string) => void;
}> = ({ isOpen, position, tab, onClose, onCloseAll, onCloseOthers, onDuplicate, onRename }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen || !tab) return null;
  
  const menuItems = [
    {
      label: "Rename",
      icon: FileText,
      action: () => onRename?.(tab.id),
      disabled: false
    },
    {
      label: "Duplicate",
      icon: Plus,
      action: () => onDuplicate?.(tab.id),
      disabled: false
    },
    { type: "separator" },
    {
      label: "Close Others",
      icon: Users,
      action: onCloseOthers,
      disabled: false
    },
    {
      label: "Close All",
      icon: XCircle,
      action: onCloseAll,
      disabled: false
    }
  ];
  
  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 5 }}
      transition={{ duration: 0.15 }}
      className="fixed z-50 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl py-2 min-w-44"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Context menu header */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          {getFileIcon(tab.sourceType, tab.remoteProvider, true)}
          <span className="text-xs text-white/90 font-medium truncate">
            {tab.fileName}
          </span>
        </div>
      </div>
      
      {menuItems.map((item, index) => {
        if (item.type === "separator") {
          return <div key={index} className="my-1 border-t border-white/10" />;
        }
        
        const Icon = item.icon;
        return (
          <motion.button
            key={item.label}
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
            onClick={() => {
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            className="w-full px-3 py-2 text-left text-sm text-white/80 hover:text-white flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Icon className="h-4 w-4 mr-3" />
            {item.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
};

/**
 * Overflow menu for when there are too many tabs
 */
const OverflowMenu: React.FC<{
  hiddenTabs: FileTab[];
  onTabClick: (fileId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ hiddenTabs, onTabClick, isOpen, onToggle }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);
  
  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className="flex items-center h-11 px-2 text-white/70 hover:text-white rounded-lg"
        title={`${hiddenTabs.length} more tabs`}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="ml-1 text-xs">{hiddenTabs.length}</span>
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute right-0 top-full mt-1 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl py-2 min-w-48 max-h-64 overflow-y-auto"
          >
            {hiddenTabs.map((tab) => (
              <motion.button
                key={tab.id}
                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                onClick={() => {
                  onTabClick(tab.id);
                  onToggle();
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 text-white/80 hover:text-white"
              >
                {getFileIcon(tab.sourceType, tab.remoteProvider)}
                <span className="truncate text-sm">{tab.fileName}</span>
                {tab.isActive && (
                  <div className="w-2 h-2 rounded-full bg-primary ml-auto" />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Main FileTabs component with enhanced UX
 */
const FileTabs: React.FC<FileTabsProps> = ({
  tabs,
  onTabClick,
  onTabClose,
  onCloseAll,
  onCloseOthers,
  onNewFile,
  className = '',
  maxVisibleTabs = 8,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    fileId: null,
  });
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Split tabs into visible and hidden
  const visibleTabs = tabs.slice(0, maxVisibleTabs);
  const hiddenTabs = tabs.slice(maxVisibleTabs);
  
  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      fileId,
    });
  };
  
  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, fileId: null });
  };
  
  const handleCloseOthers = () => {
    if (contextMenu.fileId) {
      onCloseOthers(contextMenu.fileId);
    }
  };
  
  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      scrollRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };
  
  if (tabs.length === 0) {
    return null;
  }
  
  const contextTab = tabs.find(tab => tab.id === contextMenu.fileId) || null;
  
  return (
    <>
      <div className={cn(
        "flex items-center from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-b border-white/10",
        className
      )}>
        {/* Scroll left button */}
        {scrollPosition > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleScroll('left')}
            className="p-2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
        )}
        
        {/* Tabs container */}
        <div
          ref={scrollRef}
          className="flex items-center overflow-x-auto scrollbar-none flex-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <AnimatePresence mode="popLayout">
            {visibleTabs.map((tab) => (
              <FileTabItem
                key={tab.id}
                tab={tab}
                onTabClick={onTabClick}
                onTabClose={onTabClose}
                onContextMenu={handleContextMenu}
                isOverflowing={hiddenTabs.length > 0}
              />
            ))}
          </AnimatePresence>
        </div>
        
        {/* Overflow menu */}
        {hiddenTabs.length > 0 && (
          <OverflowMenu
            hiddenTabs={hiddenTabs}
            onTabClick={onTabClick}
            isOpen={overflowMenuOpen}
            onToggle={() => setOverflowMenuOpen(!overflowMenuOpen)}
          />
        )}
        
        {/* New file button */}
        {onNewFile && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNewFile}
            className="ml-2 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Import new file"
          >
            <Plus className="h-4 w-4" />
          </motion.button>
        )}
        
        {/* Spacer */}
        <div className="flex-1 min-w-4" />
      </div>
      
      {/* Enhanced Context Menu */}
      <AnimatePresence>
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          tab={contextTab}
          onClose={closeContextMenu}
          onCloseAll={onCloseAll}
          onCloseOthers={handleCloseOthers}
          onDuplicate={(fileId) => console.log('Duplicate:', fileId)}
          onRename={(fileId) => console.log('Rename:', fileId)}
        />
      </AnimatePresence>
    </>
  );
};

export default FileTabs;