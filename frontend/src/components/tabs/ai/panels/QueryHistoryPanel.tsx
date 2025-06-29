import React, { useState } from "react";
import { 
  Clock, 
  Trash2, 
  Copy, 
  Play, 
  Search,
  Filter,
  Bot,
  DollarSign,
  CheckCircle
} from "lucide-react";

import { useAIStore } from "@/store/aiStore";
import { AIQuery } from "@/types/ai";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const QueryHistoryPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [isCopied, setIsCopied] = useState<string | null>(null);
  
  const { 
    queryHistory, 
    clearQueryHistory,
    setCurrentPrompt 
  } = useAIStore();

  // Filter queries based on search and filter
  const filteredQueries = queryHistory.filter(query => {
    const matchesSearch = searchTerm === "" || 
      query.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (query.response && query.response.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProvider = filterProvider === "all" || query.provider === filterProvider;
    
    return matchesSearch && matchesProvider;
  });

  const handleCopy = async (text: string, queryId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(queryId);
      setTimeout(() => setIsCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleReusePrompt = (prompt: string) => {
    setCurrentPrompt(prompt);
  };

  const formatTimestamp = (date: Date | string) => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Validate the date
    if (isNaN(dateObj.getTime())) {
      return "Unknown time";
    }
    
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return dateObj.toLocaleDateString();
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'text-green-400';
      case 'anthropic': return 'text-orange-400';
      case 'local': return 'text-blue-400';
      default: return 'text-purple-400';
    }
  };

  const EmptyState = () => (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-white/40" />
          </div>
        </div>
        <h4 className="text-sm font-medium text-white/70 mb-2">
          No Query History
        </h4>
        <p className="text-xs text-white/50 leading-relaxed">
          Your AI query history will appear here as you interact with the assistant.
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium text-white">Query History</h3>
          </div>
          
          {queryHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearQueryHistory}
              className="h-6 text-white/60 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white/40" />
          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 text-white/40" />
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-primary/50 p-1"
          >
            <option value="all">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="local">Local</option>
          </select>
        </div>
      </div>

      {/* Query List */}
      <div className="flex-1 overflow-y-auto">
        {filteredQueries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="p-2 space-y-2">
            {filteredQueries.map((query) => (
              <div
                key={query.id}
                className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
              >
                {/* Query Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Bot className="h-3 w-3 text-white/60 flex-shrink-0" />
                    <span className={cn("text-xs font-medium capitalize", getProviderColor(query.provider))}>
                      {query.model.split('-')[0]}
                    </span>
                  </div>
                  <span className="text-xs text-white/40 flex-shrink-0">
                    {formatTimestamp(query.timestamp)}
                  </span>
                </div>

                {/* Query Prompt */}
                <div className="mb-2">
                  <p className="text-sm text-white/90 line-clamp-2 mb-2">
                    {query.prompt}
                  </p>
                </div>

                {/* Query Stats */}
                <div className="flex items-center gap-3 mb-2 text-xs text-white/60">
                  {query.executionTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{query.executionTime}ms</span>
                    </div>
                  )}
                  
                  {query.tokens && (
                    <div className="flex items-center gap-1">
                      <span>{query.tokens.input + query.tokens.output} tokens</span>
                    </div>
                  )}
                  
                  {query.cost && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span>${query.cost.toFixed(4)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReusePrompt(query.prompt)}
                    className="h-6 text-xs"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Reuse
                  </Button>

                  <div className="flex items-center gap-1">
                    {query.generatedSQL && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(query.generatedSQL!, query.id)}
                        className="h-6 text-xs"
                      >
                        {isCopied === query.id ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {queryHistory.length > 0 && (
        <div className="p-3 border-t border-white/10 bg-darkNav/30">
          <div className="text-xs text-white/60 text-center">
            {queryHistory.length} {queryHistory.length === 1 ? 'query' : 'queries'} in history
            {filterProvider !== 'all' && ` • Filtered by ${filterProvider}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryHistoryPanel;