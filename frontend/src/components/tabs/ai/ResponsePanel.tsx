import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { useAIOperations } from "@/hooks/ai/useAIOperations";
import SQLQueryCard from "./SQLQueryCard";

const ResponsePanel: React.FC = () => {
  const { isProcessing } = useAIStore();
  const { currentResponse, streamingResponse, extractSQLQueries } = useAIOperations();
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
  
  // Split response into text and SQL blocks
  const renderResponse = () => {
    if (!displayResponse) return null;
    
    const text = displayResponse;
    const parts: Array<{ type: 'text' | 'sql', content: string }> = [];
    
    // Remove SQL blocks from text to get clean text parts
    let cleanText = text;
    const sqlBlockRegex = /```sql\n([\s\S]*?)\n```/gi;
    let lastIndex = 0;
    let match;
    
    while ((match = sqlBlockRegex.exec(text)) !== null) {
      // Add text before SQL block
      if (match.index > lastIndex) {
        const textPart = text.slice(lastIndex, match.index).trim();
        if (textPart) {
          parts.push({ type: 'text', content: textPart });
        }
      }
      
      // Add SQL block
      parts.push({ type: 'sql', content: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const textPart = text.slice(lastIndex).trim();
      if (textPart) {
        parts.push({ type: 'text', content: textPart });
      }
    }
    
    // If no SQL blocks found, just return the text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: text });
    }
    
    return parts;
  };
  
  const responseParts = renderResponse();
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Response
        </h3>
      </div>
      
      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {!displayResponse && !isProcessing ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-white/20">
                <Sparkles className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-white/50 text-sm">
                Ask a question to see AI responses here
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
                  if (part.type === 'text') {
                    return (
                      <div key={index} className="prose prose-invert max-w-none">
                        <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                          {part.content}
                        </p>
                      </div>
                    );
                  } else {
                    // Find the query index
                    const queryIndex = sqlQueries.findIndex(q => q.trim() === part.content.trim());
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
                    <span>AI is thinking...</span>
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