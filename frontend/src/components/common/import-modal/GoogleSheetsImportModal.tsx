import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  AlertCircle,
  Check,
  ArrowRight,
  FileSpreadsheet,
  Table,
  Link,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import GoogleSheetsIcon from "@/components/icons/GoogleSheetsIcon";
import GoogleSheetsPublishGuide from "./GoogleSheetsPublishGuide";
import { parseGoogleSheetsUrl } from "@/lib/google/sheetsUtils";
import useGoogleSheetsImport from "@/hooks/useGoogleSheetsImport";

export interface GoogleSheetsImportProps {
  onImport: (result: any) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const GoogleSheetsImport: React.FC<GoogleSheetsImportProps> = ({
  onImport,
  isLoading = false,
  disabled = false,
  className = "",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  
  // Google Sheets detection state
  const [isGoogleSheet, setIsGoogleSheet] = useState(false);
  const [googleSheetInfo, setGoogleSheetInfo] = useState<any>(null);
  
  // Google Sheets import hook
  const {
    importFromGoogleSheets,
    isImporting,
    importStatus,
    importProgress,
    error: importError,
  } = useGoogleSheetsImport();

  const handleOpenModal = () => {
    if (!disabled) {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset form state
    setUrl("");
    setInputError(null);
    setIsGoogleSheet(false);
    setGoogleSheetInfo(null);
  };

  // Analyze URL when it changes - detect Google Sheets
  useEffect(() => {
    if (!url.trim()) {
      setIsGoogleSheet(false);
      setGoogleSheetInfo(null);
      return;
    }

    try {
      // Check if it's a Google Sheets URL
      const sheetInfo = parseGoogleSheetsUrl(url);
      setIsGoogleSheet(sheetInfo.isGoogleSheet);
      setGoogleSheetInfo(sheetInfo);
    } catch (err) {
      setIsGoogleSheet(false);
      setGoogleSheetInfo(null);
    }
  }, [url]);

  const validateURL = (url: string): boolean => {
    // Reset previous errors
    setInputError(null);

    // Basic URL validation
    if (!url.trim()) {
      setInputError("Please enter a Google Sheets URL");
      return false;
    }

    try {
      // Create URL object to validate format
      new URL(url);

      // Validate for Google Sheets URL
      if (!isGoogleSheet) {
        setInputError("Please enter a valid Google Sheets URL that's published to the web");
        return false;
      }
      
      return true;
    } catch (err) {
      setInputError("Please enter a valid URL");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateURL(url)) {
      try {
        const result = await importFromGoogleSheets(url);
        onImport(result);
        // Close modal on success
        handleCloseModal();
      } catch (error) {
        // Error handling is already done by the hooks
      }
    }
  };

  return (
    <div className="relative">
      {/* Import Button */}
      <Button
        variant="outline"
        className="w-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-white group transition-all"
        onClick={handleOpenModal}
        disabled={isLoading || disabled}
      >
        <div className="flex items-center justify-center py-1">
          <GoogleSheetsIcon className="h-4.5 w-4.5 mr-2 text-green-500 group-hover:text-green-400" />
          <span className="text-sm font-medium">Import Google Sheets</span>
        </div>
      </Button>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-black/60"
          >
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="w-full max-w-md bg-darkNav border border-white/20 rounded-lg shadow-xl shadow-black/30 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-green-900/20 to-green-800/10">
                <h3 className="text-lg font-heading font-medium text-white flex items-center">
                  <GoogleSheetsIcon className="h-5 w-5 mr-2 text-green-500" />
                  Import from Google Sheets
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseModal}
                  className="h-8 w-8 p-0 rounded-full text-white/70 hover:text-white hover:bg-black/30"
                  disabled={isImporting}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>

              {/* URL Input Form */}
              <form onSubmit={handleSubmit}>
                <div className="p-4 space-y-4">
                  <div>
                    <label
                      htmlFor="google-sheets-url"
                      className="block text-sm font-medium text-white/80 mb-2"
                    >
                      Google Sheets URL (published to the web)
                    </label>
                    <div className="relative">
                      <input
                        id="google-sheets-url"
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/e/2PACX..."
                        className={cn(
                          "w-full px-3 py-2 h-10 bg-black/30 border border-white/20 rounded text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-white/40",
                          inputError && "border-destructive focus:ring-destructive",
                          isGoogleSheet && "border-green-500 focus:ring-green-500"
                        )}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isImporting}
                      />
                      
                      {/* Status indicator */}
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {isImporting ? (
                          <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
                        ) : isGoogleSheet ? (
                          <div className="bg-green-500/20 text-green-500 p-1 rounded-full">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : url ? (
                          <div className="bg-red-500/20 text-red-500 p-1 rounded-full">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    
                    {/* Input feedback */}
                    {inputError && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 text-xs text-destructive flex items-center"
                      >
                        <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                        {inputError}
                      </motion.p>
                    )}
                    
                    {/* Google Sheets info */}
                    {isGoogleSheet && googleSheetInfo && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="bg-green-500/10 rounded-md border border-green-500/20 p-3">
                          <div className="flex items-center text-sm text-white/90">
                            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
                            <span className="font-medium">
                              {googleSheetInfo.sheetName || "Google Sheet"}
                            </span>
                            {googleSheetInfo.format && (
                              <span className="ml-2 text-xs bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">
                                {googleSheetInfo.format.toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex mt-2 text-xs text-white/70">
                            <Table className="h-3.5 w-3.5 mr-1.5 text-white/50" />
                            <span>
                              Published sheet - ready to import
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Google Sheets Guide */}
                  <GoogleSheetsPublishGuide compact={true} />

                  {/* Loading/Status indicator for Google Sheets import */}
                  <AnimatePresence>
                    {isImporting && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="text-xs bg-green-500/10 border border-green-500/20 rounded p-3">
                          <div className="flex items-center">
                            <div className="mr-2 h-4 w-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
                            <p className="text-green-500 font-medium">
                              {importStatus}
                            </p>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-black/30 h-1.5 mt-2 rounded-full overflow-hidden">
                            <motion.div 
                              className="bg-green-500 h-full rounded-full"
                              initial={{ width: "5%" }}
                              animate={{ width: `${Math.max(5, importProgress * 100)}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Error message */}
                  <AnimatePresence>
                    {importError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="text-xs bg-destructive/10 border border-destructive/20 rounded p-3">
                          <div className="flex items-start">
                            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-destructive" />
                            <p className="text-destructive">{importError}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer with action buttons */}
                <div className="border-t border-white/10 p-4 flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    className="bg-transparent border-white/20"
                    disabled={isImporting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={cn(
                      isGoogleSheet ? "bg-green-600 hover:bg-green-700" : undefined
                    )}
                    disabled={isImporting || !url.trim() || !isGoogleSheet}
                  >
                    {isImporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import Sheet
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoogleSheetsImport;