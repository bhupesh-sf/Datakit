import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SourceTypeOption {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface SourceTypeSelectorProps {
  sourceTypes: SourceTypeOption[];
  activeType: string;
  onTypeSelect: (type: string) => void;
}

export const SourceTypeSelector: React.FC<SourceTypeSelectorProps> = ({
  sourceTypes,
  activeType,
  onTypeSelect
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {sourceTypes.map((sourceType) => {
        const Icon = sourceType.icon;
        const isActive = activeType === sourceType.type;
        
        return (
          <button
            key={sourceType.type}
            onClick={() => onTypeSelect(sourceType.type)}
            className={`
              p-1.5 rounded-lg border transition-all duration-200 text-center group relative overflow-hidden cursor-pointer
              ${isActive 
                ? 'border-primary/60 bg-primary/10 text-primary shadow-sm shadow-primary/10' 
                : 'border-white/15 bg-white/5 text-white/80 hover:border-primary/30 hover:bg-primary/5 hover:text-white/95'
              }
            `}
          >
            <div className="flex items-center gap-3 relative z-10">
              <Icon className={`h-5 w-5 transition-all duration-200 group-hover:scale-110 ${isActive ? 'drop-shadow-sm' : 'opacity-70'}`} />
              <span className="font-medium text-sm tracking-wide">{sourceType.label}</span>
            </div>
            {/* Subtle gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isActive ? 'opacity-30' : ''}`} />
          </button>
        );
      })}
    </div>
  );
};