import React, { useState, useEffect } from "react";
import {
  X,
  Globe,
  ExternalLink,
  AlertCircle,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

import S3 from "@/assets/s3.png";
import GCS from "@/assets/gcs.png";
import GoogleSheetsIcon from "@/components/icons/GoogleSheetsIcon";
import GoogleSheetsPublishGuide from "./GoogleSheetsPublishGuide";
import { parseGoogleSheetsUrl } from "@/lib/google/sheetsUtils";
import useGoogleSheetsImport from "@/hooks/useGoogleSheetsImport";

export type RemoteSourceProvider = "web" | "s3" | "gcs" | "google_sheets";

export interface RemoteFileImportProps {
  onURLSubmit: (url: string, provider: RemoteSourceProvider) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const RemoteFileImport: React.FC<RemoteFileImportProps> = ({
  onURLSubmit,
  disabled = false,
  isLoading = false,
  className = "",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedProvider, setSelectedProvider] =
    useState<RemoteSourceProvider>("web");
  const [inputError, setInputError] = useState<string | null>(null);
  const [showComingSoonPopover, setShowComingSoonPopover] = useState(false);

  // Google Sheets detection state
  const [isGoogleSheet, setIsGoogleSheet] = useState(false);
  const [googleSheetInfo, setGoogleSheetInfo] = useState<any>(null);

  // Google Sheets import hook
  const {
    importFromGoogleSheets,
    isImporting: isImportingGoogleSheet,
    importStatus: googleSheetsImportStatus,
    importProgress: googleSheetsImportProgress,
    error: googleSheetsError,
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

  const handleProviderSelect = (provider: RemoteSourceProvider) => {
    setSelectedProvider(provider);
    setInputError(null);
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

      // If it's a Google Sheet, automatically change the provider
      if (sheetInfo.isGoogleSheet) {
        setSelectedProvider("google_sheets");
      }
    } catch (err) {
      setIsGoogleSheet(false);
      setGoogleSheetInfo(null);
    }
  }, [url]);

  const validateURL = (
    url: string,
    provider: RemoteSourceProvider
  ): boolean => {
    // Reset previous errors
    setInputError(null);

    // Basic URL validation
    if (!url.trim()) {
      setInputError("Please enter a URL");
      return false;
    }

    try {
      // Create URL object to validate format
      const urlObj = new URL(url);

      // Special case for Google Sheets URLs
      if (provider === "google_sheets") {
        if (!isGoogleSheet) {
          setInputError("Please enter a valid Google Sheets URL");
          return false;
        }
        return true;
      }

      // Validate other providers
      if (provider === "web") {
        // HTTP/HTTPS protocol check
        if (!["http:", "https:"].includes(urlObj.protocol)) {
          setInputError("Web URLs must use HTTP or HTTPS protocol");
          return false;
        }
      } else if (provider === "s3") {
        // Basic S3 URL validation (s3:// or https://s3...)
        if (!url.includes("s3://") && !url.includes("amazonaws.com")) {
          setInputError("Please enter a valid S3 URL");
          return false;
        }
      } else if (provider === "gcs") {
        // Basic GCS URL validation
        if (!url.includes("storage.googleapis.com") && !url.includes("gs://")) {
          setInputError("Please enter a valid Google Cloud Storage URL");
          return false;
        }
      }

      return true;
    } catch (err) {
      setInputError("Please enter a valid URL");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateURL(url, selectedProvider)) {
      try {
        // Special handling for Google Sheets
        if (selectedProvider === "google_sheets") {
          const result = await importFromGoogleSheets(url);
          // Pass result to parent component
          await onURLSubmit(url, "google_sheets");
          // Close modal on success
          handleCloseModal();
        } else {
          // Standard URL submission for other providers
          await onURLSubmit(url, selectedProvider);
          // Close modal on success
          handleCloseModal();
        }
      } catch (error) {
        // Error handling is already done by the hooks
      }
    }
  };

  // Provider icons with labels
  const providers = [
    {
      id: "web" as const,
      icon: <Globe className="h-5 w-5" />,
      label: "Web URL",
      color: "text-blue-400",
      disabled: true,
    },
    {
      id: "google_sheets" as const,
      icon: <GoogleSheetsIcon className="h-5 w-5" />,
      label: "Google Sheets",
      color: "text-green-500",
      disabled: false,
    },
    {
      id: "s3" as const,
      icon: S3,
      label: "Amazon S3",
      color: "text-orange-400",
      disabled: true,
    },
    {
      id: "gcs" as const,
      icon: GCS,
      label: "Google Cloud",
      color: "text-green-400",
      disabled: true,
    },
  ];

  return (
    <div className="relative">
      <div
        className="relative"
        onMouseEnter={() => disabled && setShowComingSoonPopover(true)}
        onMouseLeave={() => disabled && setShowComingSoonPopover(false)}
      >
        <Button
          variant="outline"
          className={cn(
            "w-full bg-white/5 border border-white/20 hover:border-primary/80 hover:bg-black/30 transition-all mt-2",
            disabled &&
              "opacity-70 cursor-not-allowed hover:border-white/20 hover:bg-white/5"
          )}
          onClick={handleOpenModal}
          disabled={isLoading || disabled}
        >
          <div className="flex items-center justify-center w-full py-1">
            <span className="text-sm text-white/80 mr-2">Google sheets</span>
            <div className="flex items-center space-x-2">
              {providers.filter(p => !p.disabled).map((provider) => (
                <div
                  key={provider.id}
                  className={`rounded p-1 transition-transform hover:scale-110 ${provider.color}`}
                >
                  {typeof provider.icon === 'string' ? (
                    <img src={provider.icon} alt={provider.id} className="h-4 w-4" />
                  ) : (
                    provider.icon
                  )}
                </div>
              ))}
            </div>
          </div>
        </Button>

        {/* <Button
          disabled={isLoading || disabled}
          className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
          onClick={handleOpenModal}
        >
          Import Google Sheet
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button> */}
        {/* Coming Soon Popover - Shows on hover when disabled */}
        {showComingSoonPopover && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black border border-white/20 rounded-md shadow-lg p-3 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 min-w-[200px]">
            <div className="flex items-center text-primary">
              <span className="text-xs">Coming Soon!</span>
            </div>
            <p className="text-xs text-white/70 mt-1">
              Remote file import is coming in our next updates.
            </p>
            <div className="absolute h-0 w-0 border-x-8 border-x-transparent border-t-8 border-t-darkNav left-1/2 -translate-x-1/2 -bottom-2"></div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-black/60 animate-in fade-in duration-200">
          {/* Modal Content */}
          <div
            className="w-full max-w-md bg-darkNav border border-white/20 rounded-lg shadow-xl shadow-black/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-medium text-white">
                Import Remote Data File
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseModal}
                className="h-8 w-8 p-0 rounded-full text-white/70 hover:text-white hover:bg-black/30"
                disabled={isImportingGoogleSheet}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            {/* Provider Selection Tabs */}
            <div className="flex items-center border-b border-white/10">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  className={cn(
                    "flex-1 py-3 px-3 text-sm font-medium transition-all flex items-center justify-center border-b-2",
                    provider.disabled ? "opacity-50 cursor-not-allowed" : "",
                    selectedProvider === provider.id
                      ? `${provider.color} border-current`
                      : "text-white/50 border-transparent hover:text-white/70"
                  )}
                  onClick={() =>
                    !provider.disabled && handleProviderSelect(provider.id)
                  }
                  disabled={isImportingGoogleSheet || provider.disabled}
                >
                  {typeof provider.icon === "string" ? (
                    <img src={provider.icon} className="h-4 w-4" />
                  ) : (
                    provider.icon
                  )}
                  <span className="ml-2">{provider.label}</span>
                  {provider.disabled && (
                    <span className="ml-1 text-xs bg-white/10 px-1 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* URL Input Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="remote-url"
                    className="block text-sm font-medium text-white/80 mb-2"
                  >
                    {selectedProvider === "web" &&
                      "Web URL to CSV or JSON file"}
                    {selectedProvider === "google_sheets" &&
                      "Google Sheets URL (published to the web)"}
                    {selectedProvider === "s3" && "S3 URL (public access only)"}
                    {selectedProvider === "gcs" && "Google Cloud Storage URL"}
                  </label>
                  <div className="relative">
                    <input
                      id="remote-url"
                      type="text"
                      placeholder={`Enter ${
                        selectedProvider === "web"
                          ? "https://"
                          : selectedProvider === "google_sheets"
                          ? "https://docs.google.com/spreadsheets/"
                          : selectedProvider === "s3"
                          ? "s3://"
                          : "gs://"
                      }...`}
                      className={cn(
                        "w-full px-3 py-2 h-10 bg-black/30 border border-white/20 rounded text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-white/40",
                        inputError &&
                          "border-destructive focus:ring-destructive",
                        isGoogleSheet &&
                          selectedProvider === "google_sheets" &&
                          "border-green-500 focus:ring-green-500"
                      )}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isImportingGoogleSheet}
                    />
                    {isGoogleSheet && selectedProvider === "google_sheets" && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="bg-green-500/20 text-green-500 p-1 rounded-full">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                  </div>
                  {inputError && (
                    <p className="mt-1 text-xs text-destructive flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {inputError}
                    </p>
                  )}

                  {/* Google Sheets info */}
                  {isGoogleSheet &&
                    googleSheetInfo &&
                    selectedProvider === "google_sheets" && (
                      <div className="mt-2 text-xs text-green-400 flex items-center">
                        <Check className="h-3 w-3 mr-1" />
                        Valid Google Sheet
                        {googleSheetInfo.sheetName &&
                          ` (${googleSheetInfo.sheetName})`}
                        {googleSheetInfo.format &&
                          ` - ${googleSheetInfo.format.toUpperCase()} format`}
                      </div>
                    )}
                </div>

                {/* Provider-specific content */}
                {selectedProvider === "web" && (
                  <div className="text-xs text-white/60 bg-white/5 p-3 rounded">
                    <p className="font-medium mb-1.5 flex items-center">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Example Web URLs:
                    </p>
                    <ul className="space-y-1 pl-4">
                      <li>https://example.com/data/file.csv</li>
                      <li>https://data.gov/datasets/sample.json</li>
                    </ul>
                  </div>
                )}

                {/* Google Sheets Guide */}
                {selectedProvider === "google_sheets" && (
                  <GoogleSheetsPublishGuide compact={true} />
                )}

                {/* Provider warnings and info messages */}
                {selectedProvider === "web" && (
                  <div className="flex items-start text-xs text-amber-400/90 bg-amber-400/10 p-3 rounded border border-amber-400/20">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                    <p>
                      The remote server must allow cross-origin requests (CORS)
                      for browser access. Public data repositories and many APIs
                      support this, but some websites may block access.
                    </p>
                  </div>
                )}

                {/* Cloud provider notes */}
                {(selectedProvider === "s3" || selectedProvider === "gcs") && (
                  <div className="flex items-start text-xs text-blue-400/90 bg-blue-400/10 p-3 rounded border border-blue-400/20">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                    <p>
                      {selectedProvider === "s3"
                        ? "Only publicly accessible S3 buckets are supported currently. Credentials or private buckets are not supported in this version."
                        : "Only publicly accessible GCS buckets are supported currently. Authentication for private buckets is not supported in this version."}
                    </p>
                  </div>
                )}

                {/* Loading/Status indicator for Google Sheets import */}
                {isImportingGoogleSheet && (
                  <div className="text-xs bg-green-500/10 border border-green-500/20 rounded p-3">
                    <div className="flex items-center">
                      <div className="mr-2 h-4 w-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
                      <p className="text-green-500">
                        {googleSheetsImportStatus}
                      </p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-black/30 h-1.5 mt-2 rounded-full overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(
                            5,
                            googleSheetsImportProgress * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {googleSheetsError && selectedProvider === "google_sheets" && (
                  <div className="text-xs bg-destructive/10 border border-destructive/20 rounded p-3">
                    <div className="flex items-start">
                      <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-destructive" />
                      <p className="text-destructive">{googleSheetsError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with action buttons */}
              <div className="border-t border-white/10 p-4 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  className="bg-transparent border-white/20"
                  disabled={isImportingGoogleSheet}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isImportingGoogleSheet ||
                    !url.trim() ||
                    (selectedProvider === "google_sheets" && !isGoogleSheet)
                  }
                >
                  {isImportingGoogleSheet ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Importing...
                    </>
                  ) : (
                    "Import Data"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteFileImport;
