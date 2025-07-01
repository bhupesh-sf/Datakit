import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";


import { useAIStore } from "@/store/aiStore";
import { useAIOperations } from "@/hooks/ai/useAIOperations";
import { aiService } from "@/lib/ai/aiService";
import SQLQueryCard from "./SQLQueryCard";
import { Coins } from "lucide-react";

const ResponsePanel: React.FC = () => {
  const { 
    isProcessing, 
    currentResponse, 
    streamingResponse,
    currentTokenUsage,
    activeProvider,
    activeModel,
    availableModels,
    showCostEstimates
  } = useAIStore();
  const { extractSQLQueries } = useAIOperations();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use streaming response if available, otherwise use current response
  const displayResponse = streamingResponse || currentResponse;

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current && displayResponse) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayResponse]);

  // Extract SQL queries from the response
  const sqlQueries = displayResponse ? extractSQLQueries(displayResponse) : [];

  // Split response into text and SQL blocks using the same logic as extractSQLQueries
  const renderResponse = () => {
    if (!displayResponse) return null;

    const text = displayResponse;
    const parts: Array<{ type: "text" | "sql"; content: string }> = [];

    // Use extractSQLQueries to get all SQL queries
    const queries = sqlQueries;

    if (queries.length === 0) {
      // No SQL found, return as text
      return [{ type: "text", content: text }];
    }

    // Replace each SQL query with a unique placeholder
    let processedText = text;
    const placeholders: string[] = [];

    queries.forEach((query, index) => {
      const placeholder = `__SQL_PLACEHOLDER_${index}__`;
      placeholders.push(placeholder);

      // Normalize whitespace for matching
      const normalizedQuery = query.replace(/\s+/g, " ").trim();

      // Try to find and replace the query in various formats
      // 1. In code blocks
      const codeBlockPattern = new RegExp(
        `\`\`\`(?:sql)?\\s*\\n([\\s\\S]*?)\\n\\s*\`\`\``,
        "gi"
      );
      processedText = processedText.replace(
        codeBlockPattern,
        (match, content) => {
          const normalizedContent = content.replace(/\s+/g, " ").trim();
          if (normalizedContent === normalizedQuery) {
            return placeholder;
          }
          return match;
        }
      );

      // 2. As inline SQL - create regex that matches the SQL with flexible whitespace
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flexibleQueryPattern = escapedQuery.replace(/\s+/g, "\\s+");
      const queryRegex = new RegExp(flexibleQueryPattern, "gi");

      if (queryRegex.test(processedText)) {
        processedText = processedText.replace(queryRegex, placeholder);
      }
    });

    // Split by placeholders and build parts array
    const segments = processedText.split(/(__SQL_PLACEHOLDER_\d+__)/);

    segments.forEach((segment) => {
      if (segment.startsWith("__SQL_PLACEHOLDER_")) {
        // Extract the index from placeholder
        const match = segment.match(/__SQL_PLACEHOLDER_(\d+)__/);
        if (match) {
          const index = parseInt(match[1]);
          const query = queries[index];
          if (query) {
            parts.push({ type: "sql", content: query });
          }
        }
      } else if (segment.trim()) {
        parts.push({ type: "text", content: segment.trim() });
      }
    });

    return parts.length > 0 ? parts : [{ type: "text", content: text }];
  };

  const responseParts = renderResponse();
  
  // Calculate cost
  const calculateCost = () => {
    if (!currentTokenUsage || !activeProvider) return null;
    
    const cost = aiService.calculateCost(activeProvider, {
      promptTokens: currentTokenUsage.input,
      completionTokens: currentTokenUsage.output,
    });
    
    return cost;
  };
  
  const cost = calculateCost();
  const totalTokens = currentTokenUsage ? currentTokenUsage.input + currentTokenUsage.output : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          Response
        </h3>
        {showCostEstimates && currentTokenUsage && (
          <div className="flex items-center gap-3 text-xs text-white/60">
            <div className="flex items-center gap-1">
              <span>Tokens:</span>
              <span className="text-white/80 font-mono">
                {totalTokens.toLocaleString()}
              </span>
              <span className="text-white/40">
                ({currentTokenUsage.input.toLocaleString()} + {currentTokenUsage.output.toLocaleString()})
              </span>
            </div>
            {cost !== null && cost > 0 && (
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span className="text-white/80 font-mono">
                  ${cost.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {!displayResponse && !isProcessing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-white/20"></div>
              <p className="text-white/50 text-md">
                Ask a question to see responses here
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {isProcessing && !displayResponse ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="h-4 bg-white/5 rounded animate-pulse" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-1/2" />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {responseParts?.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={index}
                        className="prose prose-invert max-w-none"
                      >
                        <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                          {part.content}
                        </p>
                      </div>
                    );
                  } else {
                    // Find the query index
                    const queryIndex = sqlQueries.findIndex(
                      (q) => q.trim() === part.content.trim()
                    );
                    return (
                      <SQLQueryCard
                        key={index}
                        query={part.content}
                        index={queryIndex >= 0 ? queryIndex : 0}
                        isPrimary={queryIndex === 0}
                      />
                    );
                  }
                })}

                {/* Show thinking indicator if still processing */}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs text-white/50 mt-4">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span>Thinking...</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ResponsePanel;
