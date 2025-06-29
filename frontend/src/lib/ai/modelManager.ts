import { LocalModel } from "@/types/ai";

export interface ModelDownloadProgress {
  modelId: string;
  progress: number; // 0-100
  stage: 'downloading' | 'loading' | 'ready' | 'error';
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number;
  error?: string;
}

export interface ModelStorageInfo {
  totalModels: number;
  totalSizeBytes: number;
  availableSpace?: number;
  models: Array<{
    modelId: string;
    sizeBytes: number;
    lastUsed: Date;
    downloadDate: Date;
  }>;
}

export class ModelManager {
  private readonly STORAGE_KEY = 'datakit-local-models';
  private readonly MAX_STORAGE_GB = 10; // 10GB max for local models
  private downloadCallbacks = new Map<string, (progress: ModelDownloadProgress) => void>();

  // Get storage usage information
  async getStorageInfo(): Promise<ModelStorageInfo> {
    const models = this.getDownloadedModels();
    const totalSizeBytes = models.reduce((sum, model) => sum + (model.size * 1024 * 1024), 0);

    let availableSpace: number | undefined;
    
    // Try to get storage quota if available
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage) {
          availableSpace = estimate.quota - estimate.usage;
        }
      } catch (error) {
        console.warn('Could not estimate storage usage:', error);
      }
    }

    return {
      totalModels: models.length,
      totalSizeBytes,
      availableSpace,
      models: models.map(model => ({
        modelId: model.id,
        sizeBytes: model.size * 1024 * 1024,
        lastUsed: new Date(model.lastUsed || Date.now()),
        downloadDate: new Date(model.downloadDate || Date.now()),
      })),
    };
  }

  // Check if there's enough space for a model
  async canDownloadModel(modelSizeMB: number): Promise<{ canDownload: boolean; reason?: string }> {
    const storageInfo = await this.getStorageInfo();
    const modelSizeBytes = modelSizeMB * 1024 * 1024;
    
    // Check against our self-imposed limit
    const maxStorageBytes = this.MAX_STORAGE_GB * 1024 * 1024 * 1024;
    if (storageInfo.totalSizeBytes + modelSizeBytes > maxStorageBytes) {
      return {
        canDownload: false,
        reason: `Would exceed storage limit of ${this.MAX_STORAGE_GB}GB. Consider removing unused models.`,
      };
    }

    // Check browser quota if available
    if (storageInfo.availableSpace && storageInfo.availableSpace < modelSizeBytes * 1.2) {
      return {
        canDownload: false,
        reason: 'Insufficient browser storage space. Try clearing cache or removing other data.',
      };
    }

    return { canDownload: true };
  }

  // Mark a model as downloaded and store metadata
  markModelDownloaded(model: LocalModel): void {
    const models = this.getDownloadedModels();
    const existingIndex = models.findIndex(m => m.id === model.id);
    
    const updatedModel = {
      ...model,
      isDownloaded: true,
      downloadDate: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      models[existingIndex] = updatedModel;
    } else {
      models.push(updatedModel);
    }

    this.saveDownloadedModels(models);
  }

  // Mark a model as used (update last used timestamp)
  markModelUsed(modelId: string): void {
    const models = this.getDownloadedModels();
    const model = models.find(m => m.id === modelId);
    
    if (model) {
      model.lastUsed = new Date().toISOString();
      this.saveDownloadedModels(models);
    }
  }

  // Remove a model from downloaded list
  removeModel(modelId: string): void {
    const models = this.getDownloadedModels();
    const filteredModels = models.filter(m => m.id !== modelId);
    this.saveDownloadedModels(filteredModels);
  }

  // Get all downloaded models
  getDownloadedModels(): LocalModel[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const models = JSON.parse(stored);
      return Array.isArray(models) ? models : [];
    } catch (error) {
      console.error('Error reading downloaded models:', error);
      return [];
    }
  }

  // Check if a model is downloaded
  isModelDownloaded(modelId: string): boolean {
    const models = this.getDownloadedModels();
    return models.some(m => m.id === modelId && m.isDownloaded);
  }

  // Get a specific downloaded model
  getDownloadedModel(modelId: string): LocalModel | undefined {
    const models = this.getDownloadedModels();
    return models.find(m => m.id === modelId);
  }

  // Cleanup old models to free space
  async cleanupOldModels(targetSpaceMB: number = 2000): Promise<string[]> {
    const models = this.getDownloadedModels();
    const targetSpaceBytes = targetSpaceMB * 1024 * 1024;
    
    // Sort by last used (oldest first)
    const sortedModels = models
      .filter(m => m.lastUsed)
      .sort((a, b) => new Date(a.lastUsed!).getTime() - new Date(b.lastUsed!).getTime());

    const removedModels: string[] = [];
    let freedSpace = 0;

    for (const model of sortedModels) {
      if (freedSpace >= targetSpaceBytes) break;
      
      this.removeModel(model.id);
      removedModels.push(model.name);
      freedSpace += model.size * 1024 * 1024;
    }

    return removedModels;
  }

  // Register progress callback for model download
  onDownloadProgress(modelId: string, callback: (progress: ModelDownloadProgress) => void): void {
    this.downloadCallbacks.set(modelId, callback);
  }

  // Remove progress callback
  removeDownloadCallback(modelId: string): void {
    this.downloadCallbacks.delete(modelId);
  }

  // Emit progress update
  emitProgress(progress: ModelDownloadProgress): void {
    const callback = this.downloadCallbacks.get(progress.modelId);
    if (callback) {
      callback(progress);
    }
  }

  // Start download process (to be called by WebLLM provider)
  async startDownload(model: LocalModel): Promise<void> {
    const canDownload = await this.canDownloadModel(model.size);
    
    if (!canDownload.canDownload) {
      this.emitProgress({
        modelId: model.id,
        progress: 0,
        stage: 'error',
        message: canDownload.reason || 'Cannot download model',
        error: canDownload.reason,
      });
      throw new Error(canDownload.reason);
    }

    // Emit initial progress
    this.emitProgress({
      modelId: model.id,
      progress: 0,
      stage: 'downloading',
      message: 'Starting download...',
    });

    // The actual download will be handled by WebLLM provider
    // This just tracks the state
  }

  // Handle download completion
  handleDownloadComplete(model: LocalModel): void {
    this.markModelDownloaded(model);
    this.emitProgress({
      modelId: model.id,
      progress: 100,
      stage: 'ready',
      message: 'Model ready for use',
    });
  }

  // Handle download error
  handleDownloadError(modelId: string, error: string): void {
    this.emitProgress({
      modelId: modelId,
      progress: 0,
      stage: 'error',
      message: 'Download failed',
      error: error,
    });
  }

  // Get recommended models for cleanup
  getRecommendedCleanup(): LocalModel[] {
    const models = this.getDownloadedModels();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return models
      .filter(m => m.lastUsed && new Date(m.lastUsed) < oneMonthAgo)
      .sort((a, b) => new Date(a.lastUsed!).getTime() - new Date(b.lastUsed!).getTime());
  }

  // Save models to localStorage
  private saveDownloadedModels(models: LocalModel[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(models));
    } catch (error) {
      console.error('Error saving downloaded models:', error);
    }
  }

  // Clear all downloaded models data (for debugging/reset)
  clearAllModels(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Export model settings for backup
  exportSettings(): string {
    const models = this.getDownloadedModels();
    return JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        size: m.size,
        downloadDate: m.downloadDate,
        lastUsed: m.lastUsed,
      })),
    }, null, 2);
  }

  // Import model settings from backup
  importSettings(settingsJson: string): void {
    try {
      const settings = JSON.parse(settingsJson);
      if (settings.version === '1.0' && Array.isArray(settings.models)) {
        // This only imports metadata, not actual model files
        const currentModels = this.getDownloadedModels();
        const importedModels = settings.models.filter((imported: any) =>
          !currentModels.some(current => current.id === imported.id)
        );

        if (importedModels.length > 0) {
          this.saveDownloadedModels([...currentModels, ...importedModels]);
        }
      }
    } catch (error) {
      throw new Error('Invalid settings format');
    }
  }
}

// Global model manager instance
export const modelManager = new ModelManager();