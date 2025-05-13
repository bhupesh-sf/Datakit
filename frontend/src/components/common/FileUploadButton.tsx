import * as React from "react";
import { useState, useRef } from "react";
import { Upload, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

import csv from '@/assets/csv.png';
import json from '@/assets/json.png';
import xlsx from '@/assets/xlsx.png';


interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  accept?: string;
  className?: string;
  supportLargeFiles?: boolean;
}

export const FileUploadButton = ({
  onFileSelect,
  isLoading = false,
  accept = ".csv,.json,.xlsx,.xls",
  className = "",
  supportLargeFiles = true,
}: FileUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileIcons = {
    csv,
    json,
    xlsx
    // xls: "/icons/xls-icon.png",   
  };

  const handleButtonClick = async () => {
    if (supportLargeFiles && 'showOpenFilePicker' in window) {
      try {
        // Configure the file picker with xlsx support
        const pickerOpts = {
          types: [
            {
              description: 'Data Files',
              accept: {
                'text/csv': ['.csv'],
                'application/json': ['.json'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls']
              }
            }
          ],
          excludeAcceptAllOption: false,
          multiple: false
        };

        const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
        const file = await fileHandle.getFile();
        
        (file as any)._handle = fileHandle;
        
        onFileSelect(file);
      } catch (err) {
        if (!(err instanceof Error) || err.name !== 'AbortError') {
          console.warn('File System Access API failed, falling back to regular input:', err);
          fileInputRef.current?.click();
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (fileExt === 'csv' || fileExt === 'json' || fileExt === 'xlsx' || fileExt === 'xls') {
        onFileSelect(file);
      } else {
        alert('Please upload a CSV, JSON, or Excel file');
      }
    }
  };

  return (
    <div 
      className={`relative ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging ? (
        <div className="border-2 border-dashed border-primary rounded-lg p-6 flex flex-col items-center justify-center transition-colors bg-primary/10">
          <FileIcon className="h-10 w-10 text-primary mb-2" />
          <p className="text-primary font-medium">Drop your file here</p>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className={`w-full bg-transparent border-primary text-foreground hover:bg-primary/10 hover:text-primary transition-colors ${className}`}
            onClick={handleButtonClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent mr-2" />
                <span>Processing...</span>
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                {/* File type icons using actual images */}
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col items-center">
                    <img src={fileIcons.csv} alt="CSV" width="24" height="24" />
                    <div className="h-1 w-1 rounded-full bg-primary mt-1"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src={fileIcons.json} alt="JSON" width="18" height="18" />
                    <div className="h-1 w-1 rounded-full bg-green-400 mt-1"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src={fileIcons.xlsx} alt="XLSX" width="24" height="24" />
                    <div className="h-1 w-1 rounded-full bg-blue-400 mt-1"></div>
                  </div>
                </div>
              </div>
            )}
          </Button>
          <div className="mt-1 text-xs text-center text-white text-opacity-60">
            {supportLargeFiles && 'showOpenFilePicker' in window ? 
              'Supports files up to 5GB' : 
              'Supports files up to 2GB'}
          </div>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
        disabled={isLoading}
      />
    </div>
  );
};