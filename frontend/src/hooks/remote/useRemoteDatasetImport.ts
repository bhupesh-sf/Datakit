import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotifications } from '@/hooks/useNotifications';

import useHuggingFaceImport from '@/hooks/remote/huggingface/useHuggingFaceImport';

import type {
  DatasetProvider,
  DatasetIdentifier,
  BaseDatasetOptions,
  ImportResult,
} from './interfaces/types';

import { useAppStore } from '@/store/appStore';

export interface DatasetImportOptions
  extends DatasetIdentifier,
    BaseDatasetOptions {
  customUrl?: string;
}

export type { ImportResult as DatasetImportResult };

/**
 * Unified hook for handling dataset imports from various providers
 * with notifications and navigation support
 */
export const useRemoteDatasetImport = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();

  const { addFile } = useAppStore();

  // Initialize all provider hooks at the top level (React Rules of Hooks)
  const huggingFaceHook = useHuggingFaceImport();

  /**
   * Import dataset using the provider's existing hook (with UI state)
   */
  const importDataset = useCallback(
    async (options: DatasetImportOptions) => {
      const { provider, organization, dataset } = options;
      const datasetId = `${organization}/${dataset}`;

      try {
        let result: any;
        let providerUrl: string;

        // Route to the appropriate provider hook
        switch (provider) {
          case 'huggingface':
            result = await huggingFaceHook.importWithProgressiveFallback(
              datasetId,
              {
                config: options.config,
                split: options.split,
                authToken: options.authToken,
              }
            );
            providerUrl = `https://huggingface.co/datasets/${datasetId}`;
            break;

          case 'kaggle':
            throw new Error('Kaggle import not yet implemented');

          case 'github':
            throw new Error('GitHub import not yet implemented');

          case 'custom':
            throw new Error('Custom URL import not yet implemented');

          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }

        // Show success notification
        showSuccess(
          'Dataset Import Successful',
          `Successfully imported ${datasetId}`,
          {
            icon: 'check',
            duration: 8000,
          }
        );

        const enhancedResult = {
          ...result,
          isRemote: true,
          remoteProvider: 'huggingface',
          remoteURL: providerUrl,
        };

        addFile(enhancedResult);
      } catch (error) {
        console.error('Dataset import failed:', error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to import dataset. Please check the dataset ID and try again.';

        showError('Dataset Import Failed', errorMessage, {
          icon: 'alert-triangle',
          duration: 10000,
        });

        throw error;
      }
    },
    [showSuccess, showError, huggingFaceHook]
  );

  /**
   * Generate provider-specific URL
   */
  const generateProviderUrl = useCallback(
    (provider: DatasetProvider, datasetId: string): string => {
      switch (provider) {
        case 'huggingface':
          return `https://huggingface.co/datasets/${datasetId}`;
        case 'kaggle':
          return `https://kaggle.com/datasets/${datasetId}`;
        case 'github':
          return `https://github.com/${datasetId}`;
        default:
          return `https://${provider}.com/datasets/${datasetId}`;
      }
    },
    []
  );

  /**
   * Import dataset from URL and navigate to home
   */
  const importDatasetFromUrl = useCallback(
    async (options: DatasetImportOptions): Promise<void> => {
      try {
        await importDataset(options);
        navigate('/');
      } catch (error) {
        navigate('/');
        throw error;
      }
    },
    [importDataset, navigate]
  );

  /**
   * Get import state for a specific provider
   */
  const getImportState = useCallback(
    (provider: DatasetProvider) => {
      switch (provider) {
        case 'huggingface':
          return {
            isImporting: huggingFaceHook.isImporting,
            importProgress: huggingFaceHook.importProgress,
            importStatus: huggingFaceHook.importStatus,
            error: huggingFaceHook.error,
          };
        default:
          return {
            isImporting: false,
            importProgress: 0,
            importStatus: '',
            error: null,
          };
      }
    },
    [huggingFaceHook]
  );

  return {
    importDataset,
    importDatasetFromUrl,
    getImportState,
    generateProviderUrl,
  };
};
