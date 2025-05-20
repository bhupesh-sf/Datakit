import React from 'react';
import { ExternalLink, Clock, FileSpreadsheet } from 'lucide-react';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';
import { formatDistanceToNow } from 'date-fns';

interface GoogleSheetsMetadataProps {
  metadata: {
    sheetName: string;
    docId: string | null;
    sheetId: string | null;
    format: 'csv' | 'xlsx' | 'html' | null;
    importedAt: number;
  };
  url: string;
  className?: string;
  compact?: boolean;
}

const GoogleSheetsMetadata: React.FC<GoogleSheetsMetadataProps> = ({
  metadata,
  url,
  className = '',
  compact = false
}) => {
  const timeAgo = formatDistanceToNow(metadata.importedAt, { addSuffix: true });
  
  if (compact) {
    return (
      <div className={`flex items-center text-xs text-white/60 ${className}`}>
        <GoogleSheetsIcon className="h-3.5 w-3.5 mr-1.5 text-green-500" />
        <span>
          Google Sheets • {metadata.sheetName || 'Sheet1'} • Imported {timeAgo}
        </span>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="ml-2 text-primary hover:text-primary-foreground inline-flex items-center"
          title="Open in Google Sheets"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }
  
  return (
    <div className={`bg-green-500/10 rounded p-3 border border-green-500/20 ${className}`}>
      <div className="flex items-center">
        <GoogleSheetsIcon className="h-5 w-5 mr-2 text-green-500" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white/90">
            Imported from Google Sheets
          </h4>
          <div className="flex items-center mt-0.5">
            <Clock className="h-3 w-3 mr-1.5 text-white/50" />
            <span className="text-xs text-white/70">{timeAgo}</span>
          </div>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-black/30 hover:bg-primary/20 text-primary hover:text-primary-foreground border border-white/10 rounded px-2 py-1 text-xs flex items-center transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Open in Google Sheets
        </a>
      </div>
      
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-black/20 rounded p-2 border border-white/5">
          <div className="text-white/50 mb-1">Sheet Name</div>
          <div className="font-medium text-white/90 flex items-center">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-green-500/80" />
            {metadata.sheetName || 'Sheet1'}
          </div>
        </div>
        
        <div className="bg-black/20 rounded p-2 border border-white/5">
          <div className="text-white/50 mb-1">Format</div>
          <div className="font-medium text-white/90 uppercase">
            {metadata.format || 'CSV'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleSheetsMetadata;