import * as React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";

import csv from '@/assets/csv.png';
import json from '@/assets/json.png';
import xlsx from '@/assets/xlsx.png';
import parquet from '@/assets/parquet.png';

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
  accept = ".csv,.json,.xlsx,.xls,.parquet",
  className = "",
  supportLargeFiles = true,
}: FileUploadButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileTypes = [
    { type: 'csv', icon: csv, color: 'primary', label: 'CSV' },
    { type: 'json', icon: json, color: 'amber-100', label: 'JSON' },
    { type: 'excel', icon: xlsx, color: 'blue-400', label: 'EXCEL' },
    { type: 'parquet', icon: parquet, color: 'primary', label: 'PARQUET' }
  ];

  const handleButtonClick = async () => {
    if (supportLargeFiles && 'showOpenFilePicker' in window) {
      try {
        const pickerOpts = {
          types: [
            {
              description: 'Data Files',
              accept: {
                'text/csv': ['.csv'],
                'application/json': ['.json'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls'],
                'application/x-parquet': ['.parquet'] // Add Parquet support
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

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // Only set isDragging to false if not dragging over any children
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (
      x < rect.left ||
      x >= rect.right ||
      y < rect.top ||
      y >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['csv', 'json', 'xlsx', 'xls', 'parquet'];
      if (validExtensions.includes(fileExt || '')) {
        onFileSelect(file);
      } else {
        alert('Please upload a CSV, JSON, Excel, or Parquet file');
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
        <div className="border-2 border-dashed border-primary py-6 px-4 flex flex-col items-center justify-center transition-colors bg-primary/10 shadow-lg shadow-primary/5 rounded-lg">
          <div className="flex justify-center mb-3 gap-2">
            {fileTypes.map((type, index) => (
              <div key={index} className="transform scale-90 hover:scale-100 transition-transform">
                <img src={type.icon} alt={type.label} className="h-8 w-8" />
              </div>
            ))}
          </div>
          <p className="text-primary font-medium text-sm">Drop your file here</p>
          <p className="text-xs text-primary/70 mt-1">CSV, JSON, Excel, or Parquet</p>
        </div>
      ) : (
        <div className="overflow-hidden shadow-sm group hover:shadow-md transition-shadow rounded-lg">
          <Button
            type="button"
            variant="outline"
            className={`w-full bg-white/5 border border-white/20 hover:border-primary/80 hover:bg-black/30 transition-all p-0 h-auto rounded-lg ${className}`}
            onClick={handleButtonClick}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center w-full py-5 px-4">
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mb-2" />
                  <span className="text-sm">Processing...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {fileTypes.map((type, index) => (
                      <div key={index} className="flex flex-col items-center group-hover:transform group-hover:-translate-y-1 transition-all duration-200">
                        <img src={type.icon} alt={type.label} className="h-8 w-8" />
                        <div className={`h-1 w-1 rounded-full bg-${type.color} mt-1`} />
                        <span className={`text-[10px] mt-1`}>{type.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/80 mb-1">Click to open or drag files here</p>
                    <p className="text-[10px] text-white/50">
                      {supportLargeFiles && 'showOpenFilePicker' in window ? 
                        'Supports files up to 5GB' : 
                        'Supports files up to 2GB'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </Button>
        </div>
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