// components/common/import-modal/GoogleSheetsImportModal.tsx
import React, { useState } from 'react';
import { X, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { parseGoogleSheetsUrl } from '@/lib/google/sheetsUtils';
import useGoogleSheetsImport from '@/hooks/useGoogleSheetsImport';
import GoogleSheetsIcon from '@/components/icons/GoogleSheetsIcon';

interface GoogleSheetsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: any) => void;
}

const GoogleSheetsImportModal: React.FC<GoogleSheetsImportModalProps> = ({
  isOpen, 
  onClose,
  onImportSuccess
}) => {
  const [url, setUrl] = useState('');
  const [preferredFormat, setPreferredFormat] = useState<'csv' | 'xlsx'>('csv');
  const [inputError, setInputError] = useState<string | null>(null);
  const [sheetInfo, setSheetInfo] = useState<{isValid: boolean, name?: string}>({isValid: false});
  
  const { importFromGoogleSheets, isImporting, importStatus, error } = useGoogleSheetsImport();
  
  // Validate the URL when it changes
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (!newUrl.trim()) {
      setSheetInfo({isValid: false});
      return;
    }
    
    try {
      const info = parseGoogleSheetsUrl(newUrl);
      if (info.isGoogleSheet) {
        setSheetInfo({
          isValid: true,
          name: new URL(newUrl).searchParams.get('sheet') || 'unknown',
          format: info.format
        });
        setInputError(null);
      } else {
        setSheetInfo({isValid: false});
        setInputError('The URL is not a valid Google Sheets URL');
      }
    } catch (err) {
      setSheetInfo({isValid: false});
      setInputError('Invalid URL format');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setInputError('Please enter a Google Sheets URL');
      return;
    }
    
    try {
      const result = await importFromGoogleSheets(url, preferredFormat);
      onImportSuccess(result);
      onClose();
    } catch (err) {
      // Error is already handled in the hook
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm bg-black/60 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-darkNav border border-white/20 rounded-lg shadow-xl shadow-black/30 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-medium text-white flex items-center">
            <GoogleSheetsIcon className="h-5 w-5 mr-2" />
            Import from Google Sheets
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full text-white/70 hover:text-white hover:bg-black/30"
            disabled={isImporting}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        
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
                  placeholder="https://docs.google.com/spreadsheets/d/e/..."
                  className={`w-full px-3 py-2 h-10 bg-black/30 border border-white/20 rounded text-white/90 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-white/40 ${
                    inputError ? 'border-destructive focus:ring-destructive' : ''
                  }`}
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={isImporting}
                />
              </div>
              {inputError && (
                <p className="mt-1 text-xs text-destructive flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {inputError}
                </p>
              )}
              {sheetInfo.isValid && (
                <p className="mt-1 text-xs text-green-400 flex items-center">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  Valid Google Sheet{sheetInfo.name ? `: ${sheetInfo.name}` : ''}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Preferred Format
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={preferredFormat === 'csv'}
                    onChange={() => setPreferredFormat('csv')}
                    className="mr-2"
                    disabled={isImporting}
                  />
                  <span className="text-sm text-white/80">CSV (recommended)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value="xlsx"
                    checked={preferredFormat === 'xlsx'}
                    onChange={() => setPreferredFormat('xlsx')}
                    className="mr-2"
                    disabled={isImporting}
                  />
                  <span className="text-sm text-white/80">Excel (XLSX)</span>
                </label>
              </div>
            </div>
            
            <div className="text-xs text-white/60 bg-white/5 p-3 rounded">
              <p className="font-medium mb-1.5">How to publish your Google Sheet:</p>
              <ol className="space-y-1 pl-4">
                <li>1. Open your Google Sheet</li>
                <li>2. Go to File → Share → Publish to web</li>
                <li>3. Choose "Entire Document" and your preferred format</li>
                <li>4. Click "Publish" and copy the URL</li>
              </ol>
            </div>
            
            {/* Loading/Status indicator */}
            {isImporting && (
              <div className="text-xs bg-primary/10 border border-primary/20 rounded p-3">
                <div className="flex items-center">
                  <div className="mr-2 h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                  <p className="text-primary">{importStatus}</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="text-xs bg-destructive/10 border border-destructive/20 rounded p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-destructive" />
                  <p className="text-destructive">{error}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="border-t border-white/10 p-4 flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-transparent border-white/20"
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isImporting || !sheetInfo.isValid}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Importing...
                </>
              ) : (
                "Import Sheet"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoogleSheetsImportModal;