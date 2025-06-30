import React from "react";
import { Database, Zap, Clock, Settings } from "lucide-react";
import { useAIStore } from "@/store/aiStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName } from "@/store/selectors/appSelectors";
import { useDuckDBStore } from "@/store/duckDBStore";

interface ContextBarProps {
  onOpenApiKeyModal?: () => void;
}

const ContextBar: React.FC<ContextBarProps> = ({ onOpenApiKeyModal }) => {
  const tableName = useAppStore(selectTableName);
  const { autoExecuteSQL, setAutoExecuteSQL } = useAIStore();
  const { registeredTables } = useDuckDBStore();
  
  // Get table info if available
  const tableInfo = tableName ? registeredTables.get(tableName) : null;
  
  return (
    <div className="h-10 bg-darkNav border-b border-white/10 flex items-center justify-between px-4">
      <div className="flex items-center gap-4 text-sm">
        {/* Current Table Context */}
        {tableName ? (
          <div className="flex items-center gap-2 text-white/70">
            <Database className="h-4 w-4" />
            <span>Table: <span className="text-white font-medium">{tableName}</span></span>
            {tableInfo?.rowCount && (
              <span className="text-white/50">• {tableInfo.rowCount.toLocaleString()} rows</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-white/40">
            <Database className="h-4 w-4" />
            <span>No table selected</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {/* Settings Button */}
        {onOpenApiKeyModal && (
          <button
            onClick={onOpenApiKeyModal}
            className="flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
        )}
        
        {/* Auto-execute Toggle */}
        <button
          onClick={() => setAutoExecuteSQL(!autoExecuteSQL)}
          className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
            autoExecuteSQL 
              ? "bg-primary/20 text-primary border border-primary/30" 
              : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Auto-execute: {autoExecuteSQL ? "ON" : "OFF"}</span>
        </button>
      </div>
    </div>
  );
};

export default ContextBar;