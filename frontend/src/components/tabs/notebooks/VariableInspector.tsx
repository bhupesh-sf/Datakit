import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import {
  Eye,
  Database,
  Hash,
  Type,
  List,
  Grid3X3,
  FileText,
  Image,
  Calendar,
  ToggleLeft,
  Trash2,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Copy,
  Info,
} from "lucide-react";

import { usePythonStore } from "@/store/pythonStore";
import { Button } from "@/components/ui/Button";

interface VariableInfo {
  name: string;
  type: string;
  value: any;
  size?: number;
  shape?: number[];
  dtype?: string;
  description?: string;
}

// Icon mapping for different Python types
const getTypeIcon = (type: string) => {
  const typeMap: Record<string, any> = {
    'int': Hash,
    'float': Hash,
    'str': Type,
    'bool': ToggleLeft,
    'list': List,
    'tuple': List,
    'dict': Grid3X3,
    'DataFrame': Database,
    'Series': List,
    'ndarray': Grid3X3,
    'datetime': Calendar,
    'date': Calendar,
    'function': FileText,
    'method': FileText,
    'module': FileText,
    'NoneType': FileText,
  };
  
  const IconComponent = typeMap[type] || Eye;
  return IconComponent;
};

// Format variable value for display
const formatValue = (value: any, type: string): string => {
  if (value === null || value === undefined) {
    return 'None';
  }
  
  if (typeof value === 'string') {
    return value.length > 50 ? `"${value.substring(0, 50)}..."` : `"${value}"`;
  }
  
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  
  if (typeof value === 'number') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) {
      return `[${value.map(v => formatValue(v, typeof v)).join(', ')}]`;
    }
    return `[${formatValue(value[0], typeof value[0])}, ... (${value.length} items)]`;
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length <= 2) {
      const pairs = keys.map(k => `${k}: ${formatValue(value[k], typeof value[k])}`);
      return `{${pairs.join(', ')}}`;
    }
    return `{${keys[0]}: ..., ... (${keys.length} keys)}`;
  }
  
  return String(value);
};

// This function will be moved inside the component where t() is available

/**
 * Variable inspector component for examining Python namespace variables
 */
const VariableInspector: React.FC = () => {
  const { t } = useTranslation();
  const {
    pyodide,
    globalVariables,
    refreshVariables,
    clearPythonNamespace,
  } = usePythonStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  // Get variable description based on type and properties
  const getVariableDescription = (variable: VariableInfo): string => {
    const { type, size, shape, dtype } = variable;
    
    if (type === 'DataFrame') {
      return t('notebooks.variableInspector.dataFrameDescription', { 
        defaultValue: 'DataFrame with {{rows}} rows and {{columns}} columns',
        rows: shape?.[0] || '?',
        columns: shape?.[1] || '?'
      });
    }
    
    if (type === 'Series') {
      return t('notebooks.variableInspector.seriesDescription', {
        defaultValue: 'Series with {{size}} elements{{dtype}}',
        size: size || '?',
        dtype: dtype ? ` (${dtype})` : ''
      });
    }
    
    if (type === 'ndarray') {
      const shapeStr = shape ? `(${shape.join(', ')})` : '(?)';
      return t('notebooks.variableInspector.arrayDescription', {
        defaultValue: 'Array with shape {{shape}}{{dtype}}',
        shape: shapeStr,
        dtype: dtype ? ` (${dtype})` : ''
      });
    }
    
    if (type === 'list' && size !== undefined) {
      return t('notebooks.variableInspector.listDescription', {
        defaultValue: 'List with {{size}} elements',
        size
      });
    }
    
    if (type === 'dict' && size !== undefined) {
      return t('notebooks.variableInspector.dictDescription', {
        defaultValue: 'Dictionary with {{size}} keys',
        size
      });
    }
    
    return type;
  };

  // Auto-refresh variables when Python is ready
  useEffect(() => {
    if (pyodide.isInitialized) {
      refreshVariables();
    }
  }, [pyodide.isInitialized, refreshVariables]);

  // Convert globalVariables to VariableInfo array
  const variables: VariableInfo[] = Object.entries(globalVariables)
    .filter(([name]) => !name.startsWith('_')) // Hide private variables
    .map(([name, value]) => {
      let type = typeof value;
      let size: number | undefined;
      let shape: number[] | undefined;
      let dtype: string | undefined;

      // Handle special Python types
      if (value && typeof value === 'object') {
        if (value.__class__) {
          type = value.__class__.__name__ || type;
        }
        
        // Handle pandas DataFrame
        if (type === 'DataFrame') {
          shape = value.shape || [value.length, value.columns?.length];
          size = shape[0] * shape[1];
        }
        
        // Handle pandas Series
        if (type === 'Series') {
          size = value.length;
          dtype = value.dtype;
        }
        
        // Handle numpy arrays
        if (type === 'ndarray') {
          shape = value.shape;
          size = value.size;
          dtype = value.dtype;
        }
        
        // Handle built-in collections
        if (Array.isArray(value)) {
          type = 'list';
          size = value.length;
        } else if (type === 'object' && !value.__class__) {
          type = 'dict';
          size = Object.keys(value).length;
        }
      }

      return {
        name,
        type,
        value,
        size,
        shape,
        dtype,
        description: getVariableDescription({ name, type, value, size, shape, dtype }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter variables
  const filteredVariables = variables.filter(variable => {
    const matchesSearch = searchQuery === "" || 
      variable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      variable.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedTypes.size === 0 || selectedTypes.has(variable.type);
    
    return matchesSearch && matchesType;
  });

  // Get unique types for filtering
  const availableTypes = [...new Set(variables.map(v => v.type))].sort();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshVariables();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearNamespace = async () => {
    if (confirm(t('notebooks.variableInspector.confirmClear', { defaultValue: 'Are you sure you want to clear the Python namespace? This will remove all variables.' }))) {
      await clearPythonNamespace();
    }
  };

  const toggleExpanded = (name: string) => {
    const newExpanded = new Set(expandedVariables);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedVariables(newExpanded);
  };

  const toggleTypeFilter = (type: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    setSelectedTypes(newSelected);
  };

  const copyVariableName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
    } catch (error) {
      console.error('Failed to copy variable name:', error);
    }
  };

  if (!pyodide.isInitialized) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <Eye className="w-12 h-12 text-white/50 mx-auto mb-3" />
          <p className="text-white/70">{t('notebooks.variableInspector.pythonNotInitialized', { defaultValue: 'Python not initialized' })}</p>
          <p className="text-sm text-white/50">{t('notebooks.variableInspector.initializePython', { defaultValue: 'Initialize Python to inspect variables' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-white">{t('notebooks.variableInspector.title', { defaultValue: 'Variables' })}</h3>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title={t('notebooks.variableInspector.refreshVariables', { defaultValue: 'Refresh variables' })}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
              onClick={handleClearNamespace}
              title={t('notebooks.variableInspector.clearNamespace', { defaultValue: 'Clear namespace' })}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder={t('notebooks.variableInspector.searchPlaceholder', { defaultValue: 'Search variables...' })}
            className="w-full pl-10 pr-4 py-2 bg-background border border-white/10 rounded text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Type filters */}
        {availableTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {availableTypes.map(type => (
              <button
                key={type}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  selectedTypes.has(type)
                    ? "bg-primary/20 text-primary"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
                onClick={() => toggleTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 text-xs text-white/60">
          {t('notebooks.variableInspector.variableCount', { defaultValue: '{{filtered}} of {{total}} variables', filtered: filteredVariables.length, total: variables.length })}
        </div>
      </div>

      {/* Variables list */}
      <div className="flex-1 overflow-y-auto">
        {filteredVariables.length === 0 ? (
          <div className="p-4 text-center">
            <Eye className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/60">
              {variables.length === 0 
                ? t('notebooks.variableInspector.noVariables', { defaultValue: 'No variables in namespace' })
                : t('notebooks.variableInspector.noMatches', { defaultValue: 'No variables match your search' })
              }
            </p>
            {variables.length === 0 && (
              <p className="text-xs text-white/40 mt-1">
                {t('notebooks.variableInspector.executeCode', { defaultValue: 'Execute some Python code to see variables here' })}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredVariables.map((variable) => {
              const Icon = getTypeIcon(variable.type);
              const isExpanded = expandedVariables.has(variable.name);

              return (
                <div
                  key={variable.name}
                  className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors"
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Icon className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white text-sm font-mono">
                              {variable.name}
                            </span>
                            <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded">
                              {variable.type}
                            </span>
                          </div>
                          
                          <p className="text-xs text-white/60 mb-1">
                            {variable.description}
                          </p>
                          
                          <div className="text-xs text-white/70 font-mono">
                            {formatValue(variable.value, variable.type)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyVariableName(variable.name)}
                          title={t('notebooks.variableInspector.copyVariableName', { defaultValue: 'Copy variable name' })}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        
                        {(variable.type === 'DataFrame' || variable.type === 'dict' || variable.type === 'list') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleExpanded(variable.name)}
                            title={isExpanded ? t('notebooks.variableInspector.collapse', { defaultValue: 'Collapse' }) : t('notebooks.variableInspector.expand', { defaultValue: 'Expand' })}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Additional info for complex types */}
                    {(variable.size !== undefined || variable.shape || variable.dtype) && (
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-white/50">
                        {variable.shape && (
                          <span>{t('notebooks.variableInspector.shape', { defaultValue: 'Shape: ({{shape}})', shape: variable.shape.join(', ') })}</span>
                        )}
                        {variable.size !== undefined && !variable.shape && (
                          <span>{t('notebooks.variableInspector.size', { defaultValue: 'Size: {{size}}', size: variable.size })}</span>
                        )}
                        {variable.dtype && (
                          <span>{t('notebooks.variableInspector.dtype', { defaultValue: 'DType: {{dtype}}', dtype: variable.dtype })}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-white/10 bg-black/20 p-3">
                      <div className="text-xs text-white/70 space-y-1">
                        {variable.type === 'DataFrame' && variable.value && (
                          <div>
                            <div className="text-white/50 mb-1">{t('notebooks.variableInspector.dataFrameInfo', { defaultValue: 'DataFrame Info:' })}</div>
                            <div className="font-mono bg-black/30 p-2 rounded">
                              {t('notebooks.variableInspector.dataFrameColumns', { defaultValue: 'Columns: {{columns}}', columns: variable.value.columns?.join(', ') || 'N/A' })}<br/>
                              {t('notebooks.variableInspector.dataFrameIndex', { defaultValue: 'Index: {{count}} entries', count: variable.value.index?.length || 0 })}<br/>
                              {t('notebooks.variableInspector.memoryUsage', { defaultValue: 'Memory usage: ~{{size}} KB', size: variable.size ? Math.round(variable.size * 8 / 1024) : '?' })}
                            </div>
                          </div>
                        )}
                        
                        {(variable.type === 'dict' || variable.type === 'list') && (
                          <div>
                            <div className="text-white/50 mb-1">{t('notebooks.variableInspector.contents', { defaultValue: 'Contents:' })}</div>
                            <div className="font-mono bg-black/30 p-2 rounded max-h-32 overflow-y-auto">
                              <pre>{JSON.stringify(variable.value, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with tips */}
      {variables.length > 0 && (
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-1 text-xs text-white/50">
            <Info className="w-3 h-3" />
            <span>{t('notebooks.variableInspector.copyTip', { defaultValue: 'Click variable names to copy them to your clipboard' })}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableInspector;