import * as React from "react";
import { useState, useRef } from "react";
import { Upload, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

import csv from "@/assets/csv.png";
import json from "@/assets/json.png";
import xlsx from "@/assets/xlsx.png";
import parquet from "@/assets/parquet.png";

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

  const fileIcons = {
    csv,
    json,
    xlsx,
    parquet
  };

  const handleButtonClick = async () => {
    if (supportLargeFiles && "showOpenFilePicker" in window) {
      try {
        const pickerOpts = {
          types: [
            {
              description: "Data Files",
              accept: {
                "text/csv": [".csv"],
                "application/json": [".json"],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                  [".xlsx"],
                "application/vnd.ms-excel": [".xls"],
                "application/x-parquet": [".parquet"],
              },
            },
          ],
          excludeAcceptAllOption: false,
          multiple: false,
        };

        const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
        const file = await fileHandle.getFile();
        (file as any)._handle = fileHandle;
        onFileSelect(file);
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") {
          console.warn(
            "File System Access API failed, falling back to regular input:",
            err
          );
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

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      if (
        fileExt === "csv" ||
        fileExt === "json" ||
        fileExt === "xlsx" ||
        fileExt === "xls" || 
         fileExt === "parquet"
      ) {
        onFileSelect(file);
      } else {
        alert("Please upload a CSV, JSON, or Excel file");
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
        <div className="border-2 border-dashed border-primary py-5 px-4 flex flex-col items-center justify-center transition-colors bg-primary/10 shadow-lg shadow-primary/5">
          <div className="flex items-center justify-center space-x-4 mb-3">
            <img src={fileIcons.csv} alt="CSV" className="h-7 w-7" />
            <img src={fileIcons.json} alt="JSON" className="h-7 w-7" />
            <img src={fileIcons.xlsx} alt="XLSX" className="h-7 w-7" />
          </div>
          <p className="text-primary font-medium">Drop your file here</p>
          <p className="text-xs text-primary/70 mt-1">CSV, JSON, or Excel</p>
        </div>
      ) : (
        <div className="overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
          <Button
            type="button"
            variant="outline"
            className={`w-full bg-white/5 border border-white/20 hover:border-primary/80 hover:bg-black/30 transition-all p-0 h-auto ${className}`}
            onClick={handleButtonClick}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center w-full py-5 px-1">
              {isLoading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mb-2" />
                  <span className="text-sm">Processing...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center space-x-5 mb-3 group">
                   
                    <div className="flex flex-col items-center transform group-hover:-translate-y-1 transition-transform">
                      <img src={fileIcons.csv} alt="CSV" className="h-6 w-6" />
                      <div className="h-1 w-1 rounded-full bg-primary mt-1"></div>
                      <span className="text-[10px] mt-1 text-primary/80">
                        CSV
                      </span>
                    </div>
                    <div className="flex flex-col items-center transform group-hover:-translate-y-1 transition-transform">
                      <img
                        src={fileIcons.json}
                        alt="JSON"
                        className="h-6 w-6"
                      />
                      <div className="h-1 w-1 rounded-full bg-green-400 mt-1"></div>
                      <span className="text-[10px] mt-1 text-green-400/80">
                        JSON
                      </span>
                    </div>
                    <div className="flex flex-col items-center transform group-hover:-translate-y-1 transition-transform">
                      <img
                        src={fileIcons.xlsx}
                        alt="XLSX"
                        className="h-6 w-6"
                      />
                      <div className="h-1 w-1 rounded-full bg-blue-400 mt-1"></div>
                      <span className="text-[10px] mt-1 text-blue-400/80">
                        EXCEL
                      </span>
                    </div>
                    <div className="flex flex-col items-center transform group-hover:-translate-y-1 transition-transform">
                      <img
                        src={fileIcons.parquet}
                        alt="PARQUET"
                        className="h-6 w-6"
                      />
                      <div className="h-1 w-1 rounded-full bg-primary mt-1"></div>
                      <span className="text-[10px] mt-1 text-primary/80">
                        PARQUET
                      </span>
                      <div className="flex flex-col items-center transform group-hover:-translate-y-1 transition-transform"></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/80 mb-1">
                      Click to open or drag files here
                    </p>
                    <p className="text-[10px] text-white/50">
                      {supportLargeFiles && "showOpenFilePicker" in window
                        ? "Supports files up to 5GB"
                        : "Supports files up to 2GB"}
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
