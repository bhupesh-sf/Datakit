import React from 'react';
import { FileSpreadsheet, ExternalLink, AlertCircle } from 'lucide-react';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

interface GoogleSheetsPublishGuideProps {
  className?: string;
  compact?: boolean;
}

const GoogleSheetsPublishGuide: React.FC<GoogleSheetsPublishGuideProps> = ({
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <div className={`bg-white/5 p-3 rounded border border-white/10 text-xs ${className}`}>
        <h4 className="text-white/90 font-medium flex items-center mb-2">
          <GoogleSheetsIcon className="h-3.5 w-3.5 mr-1.5" />
          How to publish your sheet:
        </h4>
        <div className="pl-2.5 space-y-1 text-white/70">
          <p>1. Open your Google Sheet</p>
          <p>2. Go to File → Share → Publish to web</p>
          <p>3. Choose "Link" tab, select format, and click "Publish"</p>
          <p>4. Copy the URL and paste it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 p-4 rounded-lg border border-white/10 ${className}`}>
      <h3 className="text-white font-medium flex items-center text-sm mb-2">
        <GoogleSheetsIcon className="h-4 w-4 mr-2" />
        How to Publish Your Google Sheet
      </h3>
      
      <ol className="space-y-3 mt-3 text-white/80 text-sm">
        <li className="flex">
          <span className="bg-primary/20 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-3 flex-shrink-0">1</span>
          <div>
            <p>Open your Google Sheet in your browser</p>
          </div>
        </li>
        <li className="flex">
          <span className="bg-primary/20 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-3 flex-shrink-0">2</span>
          <div>
            <p>Click <strong>File</strong> → <strong>Share</strong> → <strong>Publish to web</strong></p>
          </div>
        </li>
        <li className="flex">
          <span className="bg-primary/20 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-3 flex-shrink-0">3</span>
          <div>
            <p>Under <strong>"Link"</strong> tab, select:</p>
            <p className="mt-1 pl-3 text-white/60">• Entire Document (or specific sheet)</p>
            <p className="pl-3 text-white/60">• Web page (.html), CSV (.csv), or Excel (.xlsx)</p>
          </div>
        </li>
        <li className="flex">
          <span className="bg-primary/20 text-primary rounded-full h-5 w-5 flex items-center justify-center mr-3 flex-shrink-0">4</span>
          <div>
            <p>Click <strong>"Publish"</strong> and then <strong>"Copy link"</strong></p>
            <p className="mt-1 text-white/60">You can paste this link directly into DataKit</p>
          </div>
        </li>
      </ol>
      
      <div className="mt-4 bg-black/20 p-3 rounded border border-white/5 flex items-start">
        <AlertCircle className="text-amber-400 h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-white/70">
          <span className="text-amber-400 font-medium">Important:</span> Your Google Sheet must be published to the web, which makes it publicly accessible. Do not publish sheets containing sensitive or private data.
        </p>
      </div>
      
      <a 
        href="https://support.google.com/docs/answer/183965" 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-3 text-xs text-primary flex items-center hover:underline"
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Google's official guide to publishing
      </a>
    </div>
  );
};

export default GoogleSheetsPublishGuide;