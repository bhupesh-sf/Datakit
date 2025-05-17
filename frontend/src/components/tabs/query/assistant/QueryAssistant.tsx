import React, { useState, useRef, useEffect, useMemo } from "react";
import { Sparkles, Github, X, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { processTemplate } from "@/lib/sql/templateEngine";
import { useQueryAssistantStore } from "@/store/queryAssistantStore";
import { TableSchema } from "@/hooks/query/useSchemaInfo";

interface QueryAssistantProps {
  onQueryGenerated: (sql: string) => void;
  tableSchema?: TableSchema[];
}

const QueryAssistant: React.FC<QueryAssistantProps> = ({
  onQueryGenerated,
  tableSchema = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get data from store
  const recentSuggestions = useQueryAssistantStore(
    (state) => state.recentSuggestions
  );
  const addRecentSuggestion = useQueryAssistantStore(
    (state) => state.addRecentSuggestion
  );
  const templateCategories = useQueryAssistantStore(
    (state) => state.templateCategories
  );
  const getTemplatesByCategory = useQueryAssistantStore(
    (state) => state.getTemplatesByCategory
  );

  // Filter categories based on search term - memoize to prevent unnecessary recalculation
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return templateCategories;

    return templateCategories.filter((category) => {
      const templates = getTemplatesByCategory(category);
      return templates.some(
        (template) =>
          template.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [searchTerm, templateCategories, getTemplatesByCategory]);

  // Handle template selection
  const handleSelectTemplate = (templateText: string) => {
    try {
      setProcessingError(null);
      const sql = processTemplate(templateText, tableSchema);
      onQueryGenerated(sql);
      addRecentSuggestion(templateText);
      setIsOpen(false);
    } catch (error) {
      console.error("Error processing template:", error);
      setProcessingError(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // Handle custom query submission
  const handleCustomQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;

    try {
      setProcessingError(null);
      const sql = processTemplate(customQuery, tableSchema);
      onQueryGenerated(sql);
      addRecentSuggestion(customQuery);
      setCustomQuery("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error processing custom query:", error);
      setProcessingError(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 relative"
      >
        <Sparkles size={14} className="mr-1.5" />
        <span>Write with NLP</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            className="absolute right-0 mt-1 w-80 bg-background border border-white/10 rounded-md shadow-lg z-20"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <h3 className="text-sm font-medium flex items-center">
                <Sparkles size={14} className="mr-1.5 text-primary" />
                Query Assistant
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-3 py-2 text-xs text-white/70 border-b border-white/10 bg-background/50">
              <p>
                Convert English to SQL using local text processing.
                <strong className="text-primary">
                  {" "}
                  No data leaves your browser
                </strong>
                .
              </p>
            </div>

            {/* Search */}
            {/* <div className="p-2 border-b border-white/10">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 pl-8 text-sm bg-black/20 border border-white/10 rounded"
                />
                <Search
                  size={14}
                  className="absolute left-2.5 top-2.5 text-white/40"
                />
              </div>
            </div> */}

            {/* Recent Queries */}
            {recentSuggestions.length > 0 && !searchTerm && (
              <div className="mb-2">
                <div className="px-3 py-1 text-xs font-medium text-white/50 uppercase flex items-center">
                  <History size={12} className="mr-1" />
                  Recent
                </div>
                {recentSuggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded transition-colors"
                    onClick={() => handleSelectTemplate(suggestion.text)}
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            )}

            {/* Template List */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category) => {
                  const templates = getTemplatesByCategory(category).filter(
                    (template) =>
                      !searchTerm ||
                      template.text
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                  );

                  if (templates.length === 0) return null;

                  return (
                    <div key={category} className="mb-2">
                      <div className="px-3 py-1 text-xs font-medium text-white/50 uppercase">
                        {category}
                      </div>
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 rounded transition-colors"
                          onClick={() => handleSelectTemplate(template.text)}
                        >
                          {template.text}
                        </button>
                      ))}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-sm text-white/50 text-center">
                  No matching templates found
                </div>
              )}
            </div>

            {/* Error Message */}
            {processingError && (
              <div className="px-3 py-2 m-2 text-xs bg-destructive/10 border border-destructive/20 rounded text-destructive">
                {processingError}
              </div>
            )}

            {/* Custom Query Input */}
            <form
              onSubmit={handleCustomQuerySubmit}
              className="p-2 border-t border-white/10"
            >
              <input
                type="text"
                placeholder="Type your own query in English..."
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full p-2 text-sm bg-black/20 border border-white/10 rounded mb-2"
              />
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Github size={12} className="mr-1 text-white/40" />
                  <a
                    href="https://github.com/spencermountain/compromise"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/50 hover:text-primary"
                  >
                    Powered by compromise
                  </a>
                  <span className="mx-1 text-xs text-white/30">•</span>
                  <span className="text-xs text-white/50">
                    Browser-only NLP
                  </span>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QueryAssistant;
