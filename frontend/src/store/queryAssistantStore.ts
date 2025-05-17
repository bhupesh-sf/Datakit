import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSampleTemplates, QueryTemplate } from '@/lib/sql/templates';

export interface QuerySuggestion {
  id: string;
  text: string;
  isRecent: boolean;
  timestamp: number;
}

interface QueryAssistantState {
  // Lists of queries
  recentSuggestions: QuerySuggestion[];
  customSuggestions: QuerySuggestion[];
  
  // Pre-calculated data (to avoid recalculation in selectors)
  templateCategories: string[];
  
  // Actions
  addRecentSuggestion: (text: string) => void;
  addCustomSuggestion: (text: string) => void;
  removeRecentSuggestion: (id: string) => void;
  removeCustomSuggestion: (id: string) => void;
  clearRecentSuggestions: () => void;
  
  // Utilities (these should use memoized state, not recalculate)
  getFilteredSuggestions: (searchTerm: string) => QuerySuggestion[];
  getTemplatesByCategory: (category: string) => QueryTemplate[];
}

// Get categories once during initialization to avoid recomputation
const templates = getSampleTemplates();
const categories = [...new Set(templates.map(t => t.category))];

// Pre-organize templates by category to avoid repeated filtering
const templatesByCategory: Record<string, QueryTemplate[]> = {};
categories.forEach(category => {
  templatesByCategory[category] = templates.filter(t => t.category === category);
});

export const useQueryAssistantStore = create<QueryAssistantState>()(
  persist(
    (set, get) => ({
      // Initial state
      recentSuggestions: [],
      customSuggestions: [],
      templateCategories: categories,
      
      // Actions
      addRecentSuggestion: (text: string) => {
        // Skip if text is empty
        if (!text.trim()) return;
        
        // Generate a unique ID
        const id = `recent_${Date.now()}`;
        
        set((state) => {
          // Check if already exists
          const existingIndex = state.recentSuggestions.findIndex(
            s => s.text.toLowerCase() === text.toLowerCase()
          );
          
          // If exists, move it to top
          if (existingIndex >= 0) {
            const updatedSuggestions = [...state.recentSuggestions];
            const suggestion = { ...updatedSuggestions[existingIndex], timestamp: Date.now() };
            updatedSuggestions.splice(existingIndex, 1);
            
            return {
              recentSuggestions: [suggestion, ...updatedSuggestions]
            };
          }
          
          // Add new suggestion
          const newSuggestion: QuerySuggestion = {
            id,
            text,
            isRecent: true,
            timestamp: Date.now()
          };
          
          // Keep max 10 suggestions
          return {
            recentSuggestions: [newSuggestion, ...state.recentSuggestions.slice(0, 9)]
          };
        });
      },
      
      addCustomSuggestion: (text: string) => {
        // Skip if text is empty
        if (!text.trim()) return;
        
        // Generate a unique ID
        const id = `custom_${Date.now()}`;
        
        set((state) => {
          // Check if already exists
          const existingIndex = state.customSuggestions.findIndex(
            s => s.text.toLowerCase() === text.toLowerCase()
          );
          
          // If exists, update timestamp
          if (existingIndex >= 0) {
            const updatedSuggestions = [...state.customSuggestions];
            updatedSuggestions[existingIndex] = {
              ...updatedSuggestions[existingIndex],
              timestamp: Date.now()
            };
            
            return {
              customSuggestions: updatedSuggestions
            };
          }
          
          // Add new suggestion
          const newSuggestion: QuerySuggestion = {
            id,
            text,
            isRecent: false,
            timestamp: Date.now()
          };
          
          return {
            customSuggestions: [...state.customSuggestions, newSuggestion]
          };
        });
      },
      
      removeRecentSuggestion: (id: string) => {
        set((state) => ({
          recentSuggestions: state.recentSuggestions.filter(s => s.id !== id)
        }));
      },
      
      removeCustomSuggestion: (id: string) => {
        set((state) => ({
          customSuggestions: state.customSuggestions.filter(s => s.id !== id)
        }));
      },
      
      clearRecentSuggestions: () => {
        set({ recentSuggestions: [] });
      },
      
      // Use memoized functions that don't recalculate on every call
      getFilteredSuggestions: (searchTerm: string) => {
        if (!searchTerm) {
          return [...get().recentSuggestions];
        }
        
        const term = searchTerm.toLowerCase();
        
        return [
          ...get().recentSuggestions.filter(s => 
            s.text.toLowerCase().includes(term)
          ),
          ...get().customSuggestions.filter(s => 
            s.text.toLowerCase().includes(term)
          )
        ];
      },
      
      getTemplatesByCategory: (category: string) => {
        // Return pre-calculated templates by category
        return templatesByCategory[category] || [];
      }
    }),
    {
      name: 'query-assistant-storage',
      partialize: (state) => ({
        recentSuggestions: state.recentSuggestions,
        customSuggestions: state.customSuggestions
      })
    }
  )
);