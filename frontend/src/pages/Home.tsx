import { Table, BarChart, Database, UserPen, Notebook } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import MainLayout from "@/components/layout/MainLayout";
import TabNavigation, { Tab } from "@/components/navigation/TabNavigation";
import DataPreviewTab from "@/components/tabs/DataPreviewTab";
import QueryTab from "@/components/tabs/QueryTab";
import VisualizationTab from "@/components/tabs/VisualizationTab";
import AITab from "@/components/tabs/AITab";
import NotebooksTab from "@/components/tabs/NotebooksTab";
import ActionButtons from "@/components/common/ActionButtons";
import { SEO } from "@/components/common/SEO";

import { DataSourceType } from "@/types/json";
import { useHomePageLogic } from "@/hooks/useHomePageLogic";

/**
 * Main application home page component
 */
const Home = () => {
  const {
    // Store data
    statusText,
    fileName,
    sourceType,
    jsonSchema,
    activeTab,
    jsonViewMode,
    
    // Store actions
    setActiveTab,
    setJsonViewMode,
    
    // Computed values
    feedbackContext,
    
    // Handlers
    handleDataLoad,
  } = useHomePageLogic();



  // Define available tabs
  const tabs: Tab[] = [
    { id: "preview", label: "Data Preview", icon: <Table size={16} /> },
    { id: "query", label: "Query", icon: <Database size={16} /> },
    { id: "scripts", label: "Notebook", icon: <Notebook size={16} /> },
    { id: "visualization", label: "Visualize", icon: <BarChart size={16} /> },
    { id: "ai", label: "Assistant", icon: <UserPen size={16} /> }
  ];


  // Animation variants for tab content
  const tabContentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <>
      <SEO
        title="DataKit"
        description="Modern web-based data analysis tool - Process large files locally with complete privacy"
        keywords="data analysis, sql, duckdb, charts, visualization, inspection, webassembly"
      />

      <MainLayout onDataLoad={handleDataLoad}>
        <div className="p-6 h-full flex flex-col bg-background">
          <div className="mb-4 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
              <h2 className="text-xl font-heading font-semibold text-white">
                {fileName ? `Viewing: ${fileName}` : "Welcome"}
              </h2>
              <div className="flex items-center gap-2">
                {statusText !== '' && (<span className="text-primary hidden sm:inline">•</span>)}
                <p className="text-white text-opacity-60 text-sm font-medium">
                  {statusText}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ActionButtons feedbackContext={feedbackContext} />
              {/* JSON View Mode Toggle (only show for JSON data) */}
              {sourceType === DataSourceType.JSON && jsonSchema?.isNested && (
                <div className="border border-white border-opacity-20 rounded overflow-hidden">
                  <button
                    className={`px-3 py-1 text-xs ${
                      jsonViewMode === "table"
                        ? "bg-primary text-white"
                        : "text-white text-opacity-70"
                    }`}
                    onClick={() => setJsonViewMode("table")}
                  >
                    Table
                  </button>
                  <button
                    className={`px-3 py-1 text-xs ${
                      jsonViewMode === "tree"
                        ? "bg-primary text-white"
                        : "text-white text-opacity-70"
                    }`}
                    onClick={() => setJsonViewMode("tree")}
                  >
                    Tree
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tab navigation */}
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-4"
          />

          {/* Tab content with animations */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                {activeTab === "preview" && <DataPreviewTab />}
                {activeTab === "query" && <QueryTab />}
                {activeTab === "scripts" && <NotebooksTab />}
                {activeTab === "visualization" && <VisualizationTab />}
                {activeTab === "ai" && <AITab />}
               
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </MainLayout>
    </>
  );
};

export default Home;
