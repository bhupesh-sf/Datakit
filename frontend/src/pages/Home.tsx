import MainLayout from "@/components/layout/MainLayout";
import TabNavigation, { Tab } from "@/components/navigation/TabNavigation";
import DataPreviewTab from "@/components/tabs/DataPreviewTab";
import QueryTab from "@/components/tabs/QueryTab";
import VisualizationTab from "@/components/tabs/VisualizationTab";

import { DataLoadWithDuckDBResult } from "@/components/layout/Sidebar";
import ActionButtons from "@/components/common/ActionButtons";

import { Table, BarChart, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useAppStore } from "@/store/appStore";
import {
  selectActiveFileInfo,
  selectStatusText,
  selectFileName,
  selectSourceType,
  selectJsonSchema,
} from "@/store/selectors/appSelectors";
import { DataSourceType } from "@/types/json";
import { SEO } from "@/components/common/SEO";

/**
 * Main application home page component
 */
const Home = () => {
  // Use selectors for reactive data access
  const activeFileInfo = useAppStore(selectActiveFileInfo);
  const statusText = useAppStore(selectStatusText);
  const fileName = useAppStore(selectFileName);
  const sourceType = useAppStore(selectSourceType);
  const jsonSchema = useAppStore(selectJsonSchema);

  // Get UI state and actions
  const { activeTab, jsonViewMode, setActiveTab, setJsonViewMode, addFile } =
    useAppStore();

  // Define available tabs
  const tabs: Tab[] = [
    { id: "preview", label: "Data Preview", icon: <Table size={16} /> },
    { id: "query", label: "Query", icon: <Database size={16} /> },
    { id: "visualization", label: "Visualize", icon: <BarChart size={16} /> },
  ];

  /**
   * Handle data load from sidebar
   * @param result - Parsed data result including DuckDB information
   */
  const handleDataLoad = (result: DataLoadWithDuckDBResult) => {
    // Use store action to load data

    addFile(result);
  };

  // Prepare feedback context
  const feedbackContext = fileName
    ? `Feedback provided while working with: ${fileName} (${
        sourceType === DataSourceType.JSON ? "JSON" : "CSV"
      }, ${activeFileInfo?.rowCount || 0} rows)`
    : undefined;

  // Animation variants for tab content
  const tabContentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <>
    <SEO 
        title="DataKit - Home"
        description="Modern web-based data analysis tool - Process large files locally with complete privacy"
        keywords="data analysis, sql, duckdb, charts, visualization, inspection, webassembley"
      />

    <MainLayout onDataLoad={handleDataLoad}>
      <div className="p-6 h-full flex flex-col bg-background">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-heading font-semibold">
              {fileName ? `Viewing: ${fileName}` : "Welcome"}
            </h2>
            <p className="text-white text-opacity-70 text-sm">{statusText}</p>
          </div>

          <div className="flex items-center gap-2">
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
              {activeTab === "visualization" && <VisualizationTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
    </>
  );
};

export default Home;
