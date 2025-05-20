import React from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Table, ExternalLink, Calendar } from 'lucide-react';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

interface GoogleSheetsPreviewCardProps {
  sheetInfo: {
    sheetName: string | null;
    format: string | null;
    exportUrl: string | null;
    originalUrl: string;
  };
  className?: string;
}

const GoogleSheetsPreviewCard: React.FC<GoogleSheetsPreviewCardProps> = ({
  sheetInfo,
  className = ''
}) => {
  // Format name with fallbacks
  const displayName = sheetInfo.sheetName || 'Google Sheet';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`bg-gradient-to-b from-green-900/20 to-green-800/5 rounded-md border border-green-500/20 p-3 overflow-hidden ${className}`}
    >
      <div className="flex items-start">
        {/* Left icon */}
        <div className="h-9 w-9 rounded-md bg-green-500/10 flex items-center justify-center mr-3 flex-shrink-0 border border-green-500/20">
          <GoogleSheetsIcon className="h-5 w-5 text-green-500" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <h4 className="text-sm font-medium text-white/90 truncate mr-2">
              {displayName}
            </h4>
            {sheetInfo.format && (
              <span className="text-xs bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-sm">
                {sheetInfo.format.toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="flex mt-1 text-xs text-white/70">
            <Table className="h-3.5 w-3.5 mr-1.5 text-white/50" />
            <span>
              Published sheet - ready to import
            </span>
          </div>
          
          {/* Sheet URL preview */}
          <div className="mt-2 bg-black/30 rounded border border-white/5 p-1.5 flex items-center text-xs truncate">
            <span className="text-white/40 truncate flex-1">
              {sheetInfo.originalUrl.substring(0, 40)}...
            </span>
            <a 
              href={sheetInfo.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1.5 text-primary hover:text-primary-foreground inline-flex items-center"
              title="Open in Google Sheets"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
      
      {/* Sheet grid preview (decorative) */}
      <div className="mt-3 bg-black/20 rounded border border-white/5 h-12 overflow-hidden p-1">
        <div className="grid grid-cols-4 gap-0.5 h-full">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="bg-white/5 rounded-sm flex items-center justify-center"
              style={{ opacity: 0.3 + (i % 3 * 0.15) }}
            >
              <div className="w-full h-1 bg-white/20 rounded-full" style={{ width: `${30 + (i % 4) * 15}%` }}></div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default GoogleSheetsPreviewCard;