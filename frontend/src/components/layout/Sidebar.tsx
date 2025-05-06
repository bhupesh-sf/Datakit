import { useState } from 'react';
import {  AlertCircle } from 'lucide-react';
import { FileUploadButton } from "@/components/common/FileUploadButton";
import useCSVParser from '@/hooks/useCSVParser';
import type { CSVParseResult } from '@/types/csv';

type SidebarProps = {
  onDataLoad: (result: CSVParseResult) => void;
};

const Sidebar = ({ onDataLoad }: SidebarProps) => {
  const { parseCSV, isLoading, error } = useCSVParser();
  const [processingStatus, setProcessingStatus] = useState('');
  
  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }
    
    // Validate file size (limit to 50MB for browser-based parsing)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`File size exceeds 50MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    setProcessingStatus('Parsing CSV file...');
    
    try {
      const result = await parseCSV(file);
      if (result) {
        setProcessingStatus(`Parsed ${result.rowCount} rows and ${result.columnCount} columns`);
        onDataLoad(result);
      }
    } catch (err) {
      console.error('Error parsing CSV:', err);
    }
  };
  
  return (
    <div className="h-screen w-64 bg-darkNav flex flex-col border-r border-white border-opacity-10">
      <div className="p-4 border-b border-white border-opacity-10">
        <h1 className="text-2xl font-heading font-bold text-white">Datakit</h1>
      </div>
      
      <div className="flex-1 p-4">
        <p className="text-sm text-white text-opacity-70 mb-4">
          Datakit leverages WebAssembly and DuckDB to process millions of rows 
          directly in your browser, delivering lightning-fast visualizations 
          without uploading your data to any server.
        </p>
        
        {/* Here's the minimal upload button using shadcn/ui */}
        <FileUploadButton 
          onFileSelect={handleFileUpload} 
          isLoading={isLoading}
        />
        
        {isLoading && (
          <div className="mt-2">
            <div className="w-full bg-gray-800 rounded-full h-1 mb-1">
              <div className="bg-primary h-1 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-white text-opacity-50">{processingStatus}</p>
          </div>
        )}
        
        {error && (
          <div className="mt-2 flex items-center text-red-500 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-white border-opacity-10">
        <p className="text-xs text-white text-opacity-50">
          Powered by WebAssembly and DuckDB
          <br />
          <a href="https://amin.contact" target="_blank" className="text-primary hover:underline">
            by Amin
          </a>
        </p>
      </div>
    </div>
  );
};

export default Sidebar;