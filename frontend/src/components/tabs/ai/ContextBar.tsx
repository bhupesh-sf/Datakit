import React, { useState } from "react";
import { Database, Zap, Settings, ChevronDown } from "lucide-react";
import { useAIStore } from "@/store/aiStore";
import { useAppStore } from "@/store/appStore";
import { selectTableName } from "@/store/selectors/appSelectors";
import { useDuckDBStore } from "@/store/duckDBStore";

interface ContextBarProps {
  onOpenApiKeyModal?: () => void;
}

/**
 * Table selector dropdown component
 */
const TableDropdown: React.FC<{
  selectedTable: string | null;
  onTableChange: (tableName: string) => void;
}> = ({ selectedTable, onTableChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { registeredTables } = useDuckDBStore();
  
  const tables = Array.from(registeredTables.entries());
  
  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded text-sm hover:bg-white/10 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Database className="h-4 w-4 text-white/70" />
        <span className="text-white/90">
          {selectedTable || "Select table"}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-white/50 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-black border border-white/10 rounded-lg shadow-xl z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
          {tables.length === 0 ? (
            <div className="px-3 py-2 text-sm text-white/50">
              No tables available
            </div>
          ) : (
            tables.map(([name, info]) => (
              <button
                key={name}
                className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white flex items-center justify-between transition-colors"
                onClick={() => {
                  onTableChange(name);
                  setIsOpen(false);
                }}
              >
                <span className="truncate">{name}</span>
                {info.rowCount && (
                  <span className="text-xs text-white/50 ml-2">
                    {info.rowCount.toLocaleString()} rows
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ContextBar: React.FC<ContextBarProps> = ({ onOpenApiKeyModal }) => {
  const tableName = useAppStore(selectTableName);
  const { autoExecuteSQL, setAutoExecuteSQL } = useAIStore();
  const { setActiveFile, files } = useAppStore();
  

  
  // Handle table change
  const handleTableChange = (newTableName: string) => {
    // Find the file associated with this table
    const file = files.find(f => f.tableName === newTableName);
    if (file) {
      setActiveFile(file.id);
    }
  };
  
  return (
    <div className="h-10 bg-darkNav border-b border-white/10 flex items-center justify-between px-4">
      <div className="flex items-center gap-4 text-sm">
        {/* Table Dropdown Selector */}
        <TableDropdown 
          selectedTable={tableName}
          onTableChange={handleTableChange}
        />
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