import React, { useEffect } from "react";
import { motion } from "framer-motion";

import { useAppStore } from "@/store/appStore";

import Sidebar, { DataLoadWithDuckDBResult } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  onDataLoad?: (result: DataLoadWithDuckDBResult) => void;
}

/**
 * Main layout component containing the sidebar and main content area
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children, onDataLoad }) => {
  const { sidebarCollapsed } = useAppStore();


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
        className="flex-1 h-full overflow-hidden relative z-10"
        initial={sidebarCollapsed ? "sidebarCollapsed" : "sidebarExpanded"}
        animate={sidebarCollapsed ? "sidebarCollapsed" : "sidebarExpanded"}
        variants={contentVariants}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {children}
      </motion.main>
    </div>
  );
};

export default MainLayout;