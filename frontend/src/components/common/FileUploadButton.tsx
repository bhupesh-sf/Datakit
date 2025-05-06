import * as React from "react";

import { CSVIcon } from "@/components/icons/CSVIcon";
import { Button } from "@/components/ui/Button";

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  accept?: string;
  className?: string;
}

export const FileUploadButton = ({
  onFileSelect,
  isLoading = false,
  accept = ".csv",
  className = "",
}: FileUploadButtonProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className={`w-full bg-transparent border-primary text-foreground hover:bg-primary/10 hover:text-primary transition-colors ${className}`}
        onClick={handleButtonClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CSVIcon size={16} />
            <span>Upload CSV</span>
          </>
        )}
      </Button>
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