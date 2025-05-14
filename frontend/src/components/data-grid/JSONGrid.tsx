import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

import { useAppStore } from '@/store/appStore';

import { DataSourceType } from '@/types/json';

import CSVGrid from './CSVGrid';

/**
 * Type for a node path in the JSON tree
 */
type NodePath = string;

/**
 * JSONGrid component that provides both tabular and tree views for JSON data
 */
const JSONGrid: React.FC = () => {
  // Get data from store
  const { 
    rawData, 
    jsonSchema,
    jsonViewMode,
  } = useAppStore();
  
  // State for expanded nodes in the tree view
  const [expandedNodes, setExpandedNodes] = useState<Set<NodePath>>(new Set());
  
  /**
   * Determine if JSON data has nested structure
   * First checks schema, then falls back to inspecting raw data
   */
  const isNested = useMemo(() => {
    if (jsonSchema) return jsonSchema.isNested;
    
    // Otherwise try to detect from rawData
    if (!rawData) return false;
    
    // Check for nested objects/arrays
    if (Array.isArray(rawData) && rawData.length > 0) {
      return rawData.some(item => 
        typeof item === 'object' && 
        item !== null && 
        Object.values(item).some(val => 
          val !== null && 
          typeof val === 'object'
        )
      );
    }
    
    if (typeof rawData === 'object' && rawData !== null) {
      return Object.values(rawData).some(val => 
        val !== null && 
        typeof val === 'object'
      );
    }
    
    return false;
  }, [rawData, jsonSchema]);
  
  /**
   * Toggle expansion state of a tree node
   * @param path - Dot-notation path to the node (e.g. "results.0.name")
   */
  const toggleNode = (path: NodePath) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  
  /**
   * Format value for display in tree view
   * @param value - Value to format
   */
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `Array(${value.length})`;
      }
      return `Object(${Object.keys(value).length} keys)`;
    }
    return String(value);
  };
  
  /**
   * Recursively render a node in the JSON tree view
   * @param key - Property key or array index
   * @param value - Node value
   * @param path - Current path to this node
   * @param depth - Nesting depth for indentation
   */
  const renderTreeNode = (key: string, value: any, path: NodePath = '', depth: number = 0) => {
    const isObject = value !== null && typeof value === 'object';
    const isExpanded = expandedNodes.has(path);
    const fullPath = path ? `${path}.${key}` : key;
    
    return (
      <div key={fullPath} className="json-tree-node">
        <div 
          className={`flex items-center py-1 cursor-pointer hover:bg-gray-800 pl-${depth * 4}`}
          onClick={() => isObject && toggleNode(fullPath)}
        >
          {isObject && (
            <span className="mr-1 text-primary">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          
          <span className="json-key text-amber-300 mr-1">{key}:</span>
          
          {isObject ? (
            <span className="json-preview text-white text-opacity-70">
              {Array.isArray(value) 
                ? `Array(${value.length})` 
                : `Object(${Object.keys(value).length} keys)`}
            </span>
          ) : (
            <span className={`json-value ${typeof value === 'number' ? 'text-teal-400' : 'text-purple-400'}`}>
              {formatValue(value)}
            </span>
          )}
        </div>
        
        {isObject && isExpanded && (
          <div className="json-children pl-4">
            {Array.isArray(value) ? (
              value.map((item, index) => renderTreeNode(String(index), item, fullPath, depth + 1))
            ) : (
              Object.entries(value).map(([childKey, childValue]) => 
                renderTreeNode(childKey, childValue, fullPath, depth + 1)
              )
            )}
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Render tree view for JSON data
   */
  const renderTree = () => {
    if (!rawData) return null;
    
    return (
      <div className="json-tree bg-background text-white rounded p-4 overflow-auto">
        {typeof rawData === 'object' && rawData !== null ? (
          Array.isArray(rawData) ? (
            <div className="json-array">
              {rawData.map((item, index) => renderTreeNode(String(index), item, '', 0))}
            </div>
          ) : (
            <div className="json-object">
              {Object.entries(rawData).map(([key, value]) => renderTreeNode(key, value, '', 0))}
            </div>
          )
        ) : (
          <div className="json-primitive">{formatValue(rawData)}</div>
        )}
      </div>
    );
  };
  
  return (
    <div className="json-grid-container h-full">
      {/* Grid or Tree Content */}
      <div className="view-content h-full overflow-auto">
        {(jsonViewMode === 'table' || !isNested) ? (
          <CSVGrid />
        ) : (
          renderTree()
        )}
      </div>
    </div>
  );
};

export default JSONGrid;