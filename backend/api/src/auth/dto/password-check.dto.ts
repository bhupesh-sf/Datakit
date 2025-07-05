import { IsString, MaxLength } from 'class-validator';

export class PasswordCheckDto {
  @IsString({ message: 'Password must be a string' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;
}

export class PasswordStrengthResponseDto {
  isValid: boolean;
  score: number;
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    noCommonPatterns: boolean;
    noPersonalInfo: boolean;
  };
}