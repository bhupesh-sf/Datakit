import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class SchemaInfoDto {
  name: string;
  isSystem: boolean;
  tableCount: number;
  viewCount: number;
  comment?: string;
}

export class TableInfoDto {
  name: string;
  schema: string;
  type: 'table' | 'view' | 'materialized_view';
  rowCount?: number;
  sizeBytes?: number;
  comment?: string;
  columns: ColumnInfoDto[];
  indexes?: IndexInfoDto[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyInfoDto[];
}

export class ColumnInfoDto {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  comment?: string;
  ordinalPosition: number;
  characterMaximumLength?: number;
  numericPrecision?: number;
  numericScale?: number;
}

export class IndexInfoDto {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  method: string; // btree, hash, etc.
  definition?: string;
}

export class ForeignKeyInfoDto {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedSchema: string;
  referencedColumns: string[];
  onUpdate: string;
  onDelete: string;
}

export class GetSchemaTablesDto {
  @IsOptional()
  @IsString()
  search?: string; // Filter tables by name

  @IsOptional()
  @IsBoolean()
  includeTables?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeViews?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeMaterializedViews?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeSystemTables?: boolean = false;

  @IsOptional()
  @IsBoolean()
  includeRowCounts?: boolean = false; // Can be expensive for large tables
}