import React, { useState, useEffect } from 'react';
import { get, set, keys, del } from 'idb-keyval';

import { Clock, Heart, Star, Trash, Copy, Check } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  timestamp: number;
  isFavorite: boolean;
}

interface QueryHistoryProps {
  onSelectQuery: (query: string) => void;
}

/**
 * Displays and manages previously executed and saved queries
 */
const QueryHistory: React.FC<QueryHistoryProps> = ({ onSelectQuery }) => {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [recentQueries, setRecentQueries] = useState<SavedQuery[]>([]);
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Load queries from IndexedDB
  useEffect(() => {
    const loadQueries = async () => {
      try {
        // Get all keys from the store
        const allKeys = await keys();
        
        // Filter keys for saved and recent queries
        const savedKeys = allKeys.filter(k => String(k).startsWith('saved-query:'));
        const recentKeys = allKeys.filter(k => String(k).startsWith('recent-query:'));
        
        // Load saved queries
        const savedQueryPromises = savedKeys.map(async (key) => {
          const query = await get(key);
          return query;
        });
        
        // Load recent queries
        const recentQueryPromises = recentKeys.map(async (key) => {
          const query = await get(key);
          return query;
        });
        
        // Wait for all queries to load
        const loadedSavedQueries = await Promise.all(savedQueryPromises);
        const loadedRecentQueries = await Promise.all(recentQueryPromises);
        
        // Sort by timestamp (newest first)
        setSavedQueries(loadedSavedQueries.sort((a, b) => b.timestamp - a.timestamp));
        setRecentQueries(loadedRecentQueries.sort((a, b) => b.timestamp - a.timestamp));
      } catch (err) {
        console.error('Error loading queries:', err);
      }
    };
    
    loadQueries();
  }, []);
  
  // Save a query to favorites
  const saveQuery = async (query: SavedQuery) => {
    try {
      // Create a new saved query
      const savedQuery: SavedQuery = {
        ...query,
        id: `saved-query:${Date.now()}`,
        isFavorite: true,
        timestamp: Date.now()
      };
      
      // Save to IndexedDB
      await set(savedQuery.id, savedQuery);
      
      // Update state
      setSavedQueries(prev => [savedQuery, ...prev]);
    } catch (err) {
      console.error('Error saving query:', err);
    }
  };
  
  // Delete a query
  const deleteQuery = async (query: SavedQuery) => {
    try {
      // Delete from IndexedDB
      await del(query.id);
      
      // Update state
      if (query.id.startsWith('saved-query:')) {
        setSavedQueries(prev => prev.filter(q => q.id !== query.id));
      } else {
        setRecentQueries(prev => prev.filter(q => q.id !== query.id));
      }
    } catch (err) {
      console.error('Error deleting query:', err);
    }
  };
  
  // Handle copying to clipboard
  const copyToClipboard = (query: string, id: string) => {
    navigator.clipboard.writeText(query);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  // Get queries based on active tab
  const queries = activeTab === 'recent' ? recentQueries : savedQueries;
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-medium flex items-center">
          <Clock size={16} className="mr-2 text-primary" />
          Query History
        </h3>
        
        {/* Tabs */}
        <div className="flex mt-3 border-b border-white/10">
          <button
            className={`px-3 py-1.5 text-xs font-medium ${
              activeTab === 'recent' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-white/70 hover:text-white/90'
            }`}
            onClick={() => setActiveTab('recent')}
          >
            Recent
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium ${
              activeTab === 'saved' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-white/70 hover:text-white/90'
            }`}
            onClick={() => setActiveTab('saved')}
          >
            Saved
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        {queries.length === 0 ? (
          <div className="p-4 text-center text-white/50 text-xs">
            {activeTab === 'recent' 
              ? 'No recent queries. Execute a query to see it here.' 
              : 'No saved queries. Click the star icon to save a query.'}
          </div>
        ) : (
          <div className="space-y-2">
            {queries.map(query => (
              <div 
                key={query.id} 
                className="p-2 rounded bg-background hover:bg-background/80 border border-white/5"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-white/80">
                    {query.name || 'Unnamed Query'}
                  </div>
                  <div className="flex items-center space-x-1">
                    {activeTab === 'recent' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => saveQuery(query)}
                        title="Save Query"
                      >
                        <Star size={14} className="text-secondary" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(query.query, query.id)}
                      title="Copy Query"
                    >
                      {copiedId === query.id ? (
                        <Check size={14} className="text-primary" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => deleteQuery(query)}
                      title="Delete Query"
                    >
                      <Trash size={14} className="text-destructive" />
                    </Button>
                  </div>
                </div>
                
                <div 
                  className="text-xs mt-1 p-2 bg-darkNav/60 rounded font-mono overflow-hidden max-h-20 cursor-pointer"
                  onClick={() => onSelectQuery(query.query)}
                >
                  {query.query.split('\n').slice(0, 3).join('\n')}
                  {query.query.split('\n').length > 3 && (
                    <div className="text-white/50 text-center">...</div>
                  )}
                </div>
                
                <div className="mt-1 flex justify-between items-center">
                  <div className="text-[10px] text-white/50">
                    {new Date(query.timestamp).toLocaleString()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 py-0 px-2 text-xs"
                    onClick={() => onSelectQuery(query.query)}
                  >
                    Use
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryHistory;