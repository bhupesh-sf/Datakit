import React, { useState } from "react";
import {
  FileText,
  Search,
  Play,
  Copy,
  Filter,
  Tag,
  Code2,
  BarChart3,
  Brain,
  Calculator,
  Settings,
  ChevronRight,
  Package,
} from "lucide-react";

import { usePythonStore } from "@/store/pythonStore";
import { Button } from "@/components/ui/Button";
import { SCRIPT_TEMPLATES, getTemplatesByCategory, searchTemplates } from "@/lib/python/templates";
import type { ScriptTemplate } from "@/lib/python/types";

// Category icons and labels
const CATEGORY_CONFIG = {
  data_analysis: { icon: BarChart3, label: "Data Analysis", color: "text-blue-400" },
  visualization: { icon: BarChart3, label: "Visualization", color: "text-green-400" },
  ml: { icon: Brain, label: "Machine Learning", color: "text-purple-400" },
  stats: { icon: Calculator, label: "Statistics", color: "text-orange-400" },
  utils: { icon: Settings, label: "Utilities", color: "text-gray-400" },
} as const;

/**
 * Script templates component for selecting and inserting code templates
 */
const ScriptTemplates: React.FC = () => {
  const { createCell, setActiveCellId } = usePythonStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Get filtered templates
  const getFilteredTemplates = () => {
    let templates = SCRIPT_TEMPLATES;

    // Apply search filter
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    }

    // Apply category filter
    if (selectedCategory) {
      templates = templates.filter(template => template.category === selectedCategory);
    }

    return templates;
  };

  const filteredTemplates = getFilteredTemplates();

  // Group templates by category
  const templatesByCategory = Object.keys(CATEGORY_CONFIG).reduce((acc, category) => {
    const categoryTemplates = filteredTemplates.filter(t => t.category === category);
    if (categoryTemplates.length > 0) {
      acc[category as keyof typeof CATEGORY_CONFIG] = categoryTemplates;
    }
    return acc;
  }, {} as Record<keyof typeof CATEGORY_CONFIG, ScriptTemplate[]>);

  const handleUseTemplate = (template: ScriptTemplate) => {
    // Create a new cell with the template code
    const cellId = createCell(template.code);
    setActiveCellId(cellId);
  };

  const handleCopyTemplate = async (template: ScriptTemplate) => {
    try {
      await navigator.clipboard.writeText(template.code);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy template:', error);
    }
  };

  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-white">Script Templates</h3>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-white/10 rounded text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          <button
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedCategory === null
                ? "bg-primary/20 text-primary"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map(category => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;
            return (
              <button
                key={category}
                className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                  selectedCategory === category
                    ? "bg-primary/20 text-primary"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              >
                <Icon className="w-3 h-3" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="p-4 text-center">
            <FileText className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/60">
              {searchQuery ? "No templates found" : "No templates available"}
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-2">
            {Object.entries(templatesByCategory).map(([category, templates]) => {
              const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
              const Icon = config.icon;

              return (
                <div key={category} className="space-y-2">
                  {/* Category header (only show if not filtering by category) */}
                  {selectedCategory === null && (
                    <div className="flex items-center gap-2 px-2 py-1">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <h4 className="font-medium text-white text-sm">{config.label}</h4>
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-xs text-white/50">{templates.length}</span>
                    </div>
                  )}

                  {/* Templates in this category */}
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors"
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-white text-sm mb-1">
                              {template.name}
                            </h5>
                            <p className="text-xs text-white/60 line-clamp-2">
                              {template.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyTemplate(template)}
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            
                            <Button
                              variant="primary"
                              size="sm"
                              className="h-7 px-3 text-xs"
                              onClick={() => handleUseTemplate(template)}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Use
                            </Button>
                          </div>
                        </div>

                        {/* Tags */}
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {template.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded flex items-center gap-1"
                              >
                                <Tag className="w-2 h-2" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Required packages */}
                        {template.requiredPackages && template.requiredPackages.length > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Package className="w-3 h-3 text-secondary" />
                            <span className="text-xs text-white/60">
                              Requires: {template.requiredPackages.join(", ")}
                            </span>
                          </div>
                        )}

                        {/* Expand/collapse code preview */}
                        <button
                          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 transition-colors"
                          onClick={() => setExpandedTemplate(
                            expandedTemplate === template.id ? null : template.id
                          )}
                        >
                          <ChevronRight 
                            className={`w-3 h-3 transition-transform ${
                              expandedTemplate === template.id ? 'rotate-90' : ''
                            }`} 
                          />
                          <Code2 className="w-3 h-3" />
                          {expandedTemplate === template.id ? 'Hide' : 'Show'} code
                        </button>
                      </div>

                      {/* Code preview */}
                      {expandedTemplate === template.id && (
                        <div className="border-t border-white/10 bg-black/20">
                          <pre className="text-xs text-white/80 p-3 overflow-x-auto max-h-64 overflow-y-auto">
                            <code>{template.code}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with template count */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>
            {filteredTemplates.length} templates
            {selectedCategory && ` in ${CATEGORY_CONFIG[selectedCategory as keyof typeof CATEGORY_CONFIG].label}`}
          </span>
          
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptTemplates;