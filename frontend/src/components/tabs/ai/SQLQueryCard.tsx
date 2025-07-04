import React, { useState } from "react";
import { Play, Copy, Check, Code, PenSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Prism from "prismjs";
import "prismjs/components/prism-sql";

import { useAppStore } from "@/store/appStore";

import { useAIOperations } from "@/hooks/ai/useAIOperations";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

interface SQLQueryCardProps {
  query: string;
  index: number;
  isPrimary?: boolean;
}

const SQLQueryCard: React.FC<SQLQueryCardProps> = ({
  query,
  index,
  isPrimary = false,
}) => {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { setActiveTab, setPendingQuery } = useAppStore();
  const { handleRunSQL } = useAIOperations();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleRun = () => {
    handleRunSQL(query);
  };

  const handleEdit = () => {
    // Set the query as pending query
    setPendingQuery(query);
    // Switch to query tab
    setActiveTab("query");
    // Navigate to home page if not already there
    navigate("/");
  };

  // Get syntax highlighted HTML
  const getHighlightedSQL = () => {
    try {
      return Prism.highlight(query, Prism.languages.sql, "sql");
    } catch {
      return query;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`group relative bg-white/5 border rounded-lg overflow-hidden transition-all hover:bg-white/[0.07] ${
        isPrimary ? "border-primary/30" : "border-white/10"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-white/50" />
          <span className="text-xs font-medium text-white/70">
            Query {index + 1}
            {isPrimary && (
              <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                Primary
              </span>
            )}
          </span>
        </div>

        {/* Actions - visible on hover */}
        <div className="flex items-center gap-1 opacity-100 transition-opacity">
          <Tooltip content={copied ? "Copied!" : "Copy SQL"} placement="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content="Edit in Query Tab" placement="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleEdit}
            >
              <PenSquare className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>

          <Tooltip content="Run" placement="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:text-primary/80"
              onClick={handleRun}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* SQL Content */}
      <div className="p-4">
        <pre className="text-sm overflow-x-auto">
          <code
            className="language-sql text-white/80"
            dangerouslySetInnerHTML={{ __html: getHighlightedSQL() }}
          />
        </pre>
      </div>
    </motion.div>
  );
};

export default SQLQueryCard;
