import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

interface GoogleSheetsFeatureHighlightProps {
  onImportClick: () => void;
  className?: string;
}

const GoogleSheetsFeatureHighlight: React.FC<GoogleSheetsFeatureHighlightProps> = ({
  onImportClick,
  className = ''
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-green-500/10 border border-green-500/30 rounded-lg p-3 ${className}`}
    >
      <div className="flex items-center">
        <div className="h-8 w-8 rounded-full bg-green-600/20 flex items-center justify-center mr-2 flex-shrink-0">
          <GoogleSheetsIcon className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Import from Google Sheets</h3>
          <p className="text-xs text-white/70">Bring data directly from published Google Sheets</p>
        </div>
      </div>
      
      <Button 
        className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
        onClick={onImportClick}
      >
        Import Google Sheet
        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
      </Button>
    </motion.div>
  );
};

export default GoogleSheetsFeatureHighlight;