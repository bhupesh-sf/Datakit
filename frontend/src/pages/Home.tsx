import MainLayout from "@/components/layout/MainLayout";
import TabNavigation, { Tab } from "@/components/navigation/TabNavigation";
import DataPreviewTab from "@/components/tabs/DataPreviewTab";
import QueryTab from "@/components/tabs/QueryTab";
import VisualizationTab from "@/components/tabs/VisualizationTab";
import FeedbackButton from "@/components/common/FeedbackButton";
import ProductHuntButton from "@/components/common/ProductHuntButton";
import { DataLoadWithDuckDBResult } from "@/components/layout/Sidebar";

import { Table, BarChart, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useAppStore } from "@/store/appStore";
import { DataSourceType } from "@/types/json";

/**
 * Main application home page component
 */
const Home = () => {
  const {
    fileName,
    sourceType,
    jsonSchema,
    rowCount,
    columnCount,
    inDuckDB,
    tableName,
    activeTab,
    jsonViewMode,
    setActiveTab,
    setJsonViewMode,
    loadData,
  } = useAppStore();

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
    loadData(result);

    // Switch to preview tab when new data is loaded
    setActiveTab("preview");
  };

  /**
   * Get status text for the current dataset
   */
  const getStatusText = () => {
    if (!fileName) {
      return "Bring a CSV, PARQUET, XSLX or JSON file to get started.";
    }

    const baseText = `${rowCount.toLocaleString()} rows × ${columnCount.toLocaleString()} columns | ${
      sourceType === DataSourceType.JSON
        ? "JSON data"
        : sourceType === DataSourceType.PARQUET
        ? "Parquet data"
        : sourceType === DataSourceType.XLSX
        ? "Excel data"
        : "CSV data"
    }`;

    const duckDBText = inDuckDB
      ? ` | Loaded in DuckDB (table: ${tableName})`
      : "";

    const interactionText =
      sourceType === DataSourceType.JSON && jsonViewMode === "tree"
        ? " | Explore the JSON structure."
        : " | Use SQL queries for analysis.";

    return baseText + duckDBText + interactionText;
  };

  // Prepare feedback context
  const feedbackContext = fileName
    ? `Feedback provided while working with: ${fileName} (${
        sourceType === DataSourceType.JSON ? "JSON" : "CSV"
      }, ${rowCount} rows)`
    : undefined;

  // Animation variants for tab content
  const tabContentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <MainLayout onDataLoad={handleDataLoad}>
      <div className="p-6 h-full flex flex-col bg-background">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-heading font-semibold">
              {fileName ? `Viewing: ${fileName}` : "Playground"}
            </h2>
            <p className="text-white text-opacity-70 text-sm">
              {getStatusText()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* ProductHunt Button */}
            <ProductHuntButton variant="primary" size="sm" text="Support us" />

            {/* Feedback Button using our reusable component */}
            <FeedbackButton context={feedbackContext} />

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
  );
};

export default Home;
