import { IsEmail, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateWaitlistDto {
  @IsEmail()
  email: string;

  @IsString()
  featureName: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
