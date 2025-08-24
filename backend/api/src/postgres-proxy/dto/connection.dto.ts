import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePostgresConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9.-]+$/, {
    message: 'Host must contain only alphanumeric characters, dots, and hyphens',
  })
  host: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  database: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schema?: string;

  @IsOptional()
  @IsBoolean()
  sslEnabled?: boolean = false;

  @IsOptional()
  @IsObject()
  sslConfig?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(300)
  connectionTimeout?: number = 30;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1000)
  @Max(300000)
  queryTimeout?: number = 30000;
}

export class UpdatePostgresConnectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9.-]+$/)
  host?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  database?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schema?: string;

  @IsOptional()
  @IsBoolean()
  sslEnabled?: boolean;

  @IsOptional()
  @IsObject()
  sslConfig?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(300)
  connectionTimeout?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1000)
  @Max(300000)
  queryTimeout?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestConnectionDto {
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port: number;

  @IsString()
  @IsNotEmpty()
  database: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsBoolean()
  sslEnabled?: boolean = false;

  @IsOptional()
  @IsObject()
  sslConfig?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(300)
  connectionTimeout?: number = 30;
}