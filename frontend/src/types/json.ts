import { ColumnType, CSVParseResult } from "./csv";

export enum DataSourceType {
  CSV = "CSV",
  JSON = "JSON",
  Parquet = "Parquet",
  XLSX = "xlsx",
}

export interface JsonSchema {
  properties: Record<string, ColumnType>;
  isNested: boolean;
}

export interface DataParseResult extends Omit<CSVParseResult, "stats"> {
  sourceType: DataSourceType;
  rawData?: any;
  schema?: JsonSchema;
  stats?: {
    bytesProcessed: number;
    rowsProcessed?: number;
    itemsProcessed?: number;
    chunksProcessed: number;
    totalBytes?: number;
    isNested?: boolean;
  };
}
