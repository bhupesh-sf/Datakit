export type DatasetProvider = "huggingface" | "kaggle" | "github" | "custom";

export interface BaseDatasetOptions {
  authToken?: string;
  config?: string;
  split?: string;
}

export interface DatasetIdentifier {
  provider: DatasetProvider;
  organization: string;
  dataset: string;
}

export interface ImportResult {
  tableName: string;
  provider: DatasetProvider;
  success: boolean;
  metadata: {
    method: string;
    importedAt: string;
    organization: string;
    dataset: string;
    config?: string;
    split?: string;
    [key: string]: any;
  };
}
