import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Table, BarChart, Database, UserPen, Notebook } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppStore } from "@/store/appStore";
import TabNavigation, { Tab } from "@/components/navigation/TabNavigation";
import ActionButtons from "@/components/common/ActionButtons";

import Sidebar, { DataLoadWithDuckDBResult } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  onDataLoad?: (result: DataLoadWithDuckDBResult) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  feedbackContext?: string;
  showTabs?: boolean;
}

/**
 * Main layout component containing the sidebar and main content area
 */
const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  onDataLoad, 
  activeTab = "preview",
  onTabChange,
  feedbackContext,
  showTabs = true
}) => {
  const { sidebarCollapsed } = useAppStore();
  const { t } = useTranslation();

  // Define available tabs
  const tabs: Tab[] = [
    { id: "preview", label: t('layout.navigation.tabs.preview'), icon: <Table size={16} /> },
    { id: "query", label: t('layout.navigation.tabs.query'), icon: <Database size={16} /> },
    { id: "scripts", label: t('layout.navigation.tabs.notebook'), icon: <Notebook size={16} /> },
    { id: "visualization", label: t('layout.navigation.tabs.visualization'), icon: <BarChart size={16} /> },
    { id: "ai", label: t('layout.navigation.tabs.ai'), icon: <UserPen size={16} /> }
  ];


  // Add keyboard shortcut for toggling sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar on Ctrl+B or Command+B
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        useAppStore.getState().toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Animation variants for the main content
  const contentVariants = {
    sidebarExpanded: {
      marginLeft: "0",
      width: "calc(100% - 16rem)" // subtract w-64 (16rem)
    },
    sidebarCollapsed: {
      marginLeft: "0",
      width: "calc(100% - 4rem)" // subtract mini sidebar width
    },
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <div className="relative">
        <Sidebar onDataLoad={onDataLoad} />
      </div>

      {/* Main content area */}
      <motion.main
        className="flex-1 h-full overflow-hidden relative z-10 flex flex-col"
        initial={sidebarCollapsed ? "sidebarCollapsed" : "sidebarExpanded"}
        animate={sidebarCollapsed ? "sidebarCollapsed" : "sidebarExpanded"}
        variants={contentVariants}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Header with tabs on left and action buttons on right */}
        {showTabs && (
          <div className="relative px-6 pt-6 pb-2">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onChange={onTabChange}
              className=""
            />
            {/* Action Buttons positioned absolutely on the right */}
            <div className="absolute right-6 top-6">
              <ActionButtons feedbackContext={feedbackContext} />
            </div>
          </div>
        )}
        
        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </motion.main>
    </div>
  );
};

export default MainLayout;