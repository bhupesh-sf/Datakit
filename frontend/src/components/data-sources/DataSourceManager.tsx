import React, { useState } from 'react';
import { FileUploadButton } from '@/components/common/FileUploadButton';
import { SourceTypeSelector } from './SourceTypeSelector';

import { File, Cloud } from 'lucide-react';
import s3Logo from '@/assets/s3.png';
import huggingfaceLogo from '@/assets/huggingface.png';
import motherDuckLogo from '@/assets/motherduck.png';
import googleDriveLogo from '@/assets/drive.svg';
import xlsxLogo from '@/assets/xlsx.png';

export type SourceType = 'file' | 'cloud';

interface DataSourceManagerProps {
  /** Callback when files are selected (maintains compatibility) */
  onFileSelect?: (file: File) => void;
  /** Callback when file handle is selected (maintains compatibility) */
  onFileHandleSelect?: (handle: FileSystemFileHandle, file: File) => void;
  /** Callback when remote modal should open */
  onRemoteClick?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Custom className */
  className?: string;
}

export const DataSourceManager: React.FC<DataSourceManagerProps> = ({
  onFileSelect,
  onFileHandleSelect,
  onRemoteClick,
  isLoading = false,
  className = '',
}) => {
  const [activeSourceType, setActiveSourceType] = useState<SourceType>('file');

  const sourceTypes = [
    {
      type: 'file' as SourceType,
      label: 'Files',
      icon: File,
      description: 'Local files',
    },
    {
      type: 'cloud' as SourceType,
      label: 'Cloud',
      icon: Cloud,
      description: 'Remote data',
    },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Source Type Selector */}
      <SourceTypeSelector
        sourceTypes={sourceTypes}
        activeType={activeSourceType}
        onTypeSelect={setActiveSourceType}
      />

      {/* Source Type Panels */}
      <div className="min-h-[100px]">
        {activeSourceType === 'file' && (
          <FileUploadButton
            onFileSelect={onFileSelect}
            onFileHandleSelect={onFileHandleSelect}
            isLoading={isLoading}
            className="w-full"
          />
        )}

        {activeSourceType === 'cloud' && (
          <div className="flex items-center justify-center">
            <button
              onClick={onRemoteClick}
              className="group flex flex-col items-center justify-center py-6 px-4 rounded-lg bg-white/3 backdrop-blur-sm border border-white/10 hover:bg-black/40 hover:border-white/20 hover:bg-white/5 transition-all duration-300 w-full relative overflow-hidden cursor-pointer shadow-md hover:shadow-xl hover:shadow-primary/10"
              style={{
                boxShadow:
                  '0 2px 4px -1px rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
              }}
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
              </div>

              <h3 className="text-sm font-medium text-white mb-4 relative z-10 tracking-wide">
                Connect Cloud Sources
              </h3>

              {/* Provider logos - 4 smaller icons */}
              <div className="flex items-center gap-2 relative z-10">
                <img
                  src={s3Logo}
                  alt="S3"
                  className="h-5 w-5 object-contain opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                />
                <img
                  src={motherDuckLogo}
                  alt="Motherduck"
                  className="h-10 w-10 opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                />
             
                <img
                  src={huggingfaceLogo}
                  alt="Hugging Face"
                  className="h-5 w-5 opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                />
                <img
                  src={googleDriveLogo}
                  alt="Google Drive"
                  className="h-10 w-10 object-contain opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                />
                   <img
                  src={xlsxLogo}
                  alt="Xlsx"
                  className="h-6 w-6 opacity-40 group-hover:opacity-100 transition-opacity duration-300"
                />
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
