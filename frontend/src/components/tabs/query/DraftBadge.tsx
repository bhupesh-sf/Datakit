import React from 'react';

interface DraftBadgeProps {
  isDirty: boolean;
}

/**
 * Badge component that shows when a query has been modified but not executed
 */
export const DraftBadge: React.FC<DraftBadgeProps> = ({ 
  isDirty
}) => {
  
  if (!isDirty) return null;
  
  return (
    <div className="flex items-center px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mr-1.5"></div>
      Draft
    </div>
  );
};