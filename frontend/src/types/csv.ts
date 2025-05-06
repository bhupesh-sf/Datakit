export type CSVRow = string[];
export type CSVData = CSVRow[];

export enum ColumnType {
  Text = 'text',
  Number = 'number',
  Date = 'date',
  Boolean = 'boolean',
  Unknown = 'unknown'
}

export interface CSVParseResult {
  data: CSVData;
  columnTypes: ColumnType[];
  fileName: string;
  rowCount: number;
  columnCount: number;
}

export interface CSVParseOptions {
  delimiter?: string;
  header?: boolean;
  dynamicTyping?: boolean;
  skipEmptyLines?: boolean;
}