import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-4 (4 being strongest)
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

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(password: string, args: ValidationArguments): boolean {
    return this.validatePassword(password).isValid;
  }

  defaultMessage(args: ValidationArguments): string {
    const password = args.value;
    if (!password) return 'Password is required';

    const result = this.validatePassword(password);
    return `Password does not meet security requirements: ${result.feedback.join(', ')}`;
  }

  validatePassword(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    const requirements = {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumbers: false,
      hasSpecialChars: false,
      noCommonPatterns: false,
      noPersonalInfo: false,
    };

    // Check minimum length (12 characters based on OWASP recommendations)
    requirements.minLength = password.length >= 12;
    if (!requirements.minLength) {
      feedback.push('Must be at least 12 characters long');
    }

    // Check for uppercase letters
    requirements.hasUppercase = /[A-Z]/.test(password);
    if (!requirements.hasUppercase) {
      feedback.push('Must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    requirements.hasLowercase = /[a-z]/.test(password);
    if (!requirements.hasLowercase) {
      feedback.push('Must contain at least one lowercase letter');
    }

    // Check for numbers
    requirements.hasNumbers = /\d/.test(password);
    if (!requirements.hasNumbers) {
      feedback.push('Must contain at least one number');
    }

    // Check for special characters
    requirements.hasSpecialChars =
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    if (!requirements.hasSpecialChars) {
      feedback.push('Must contain at least one special character');
    }

    // Check for common patterns
    requirements.noCommonPatterns = this.checkCommonPatterns(password);
    if (!requirements.noCommonPatterns) {
      feedback.push(
        'Contains common patterns (avoid sequences like 123, abc, or repeated characters)',
      );
    }

    // Set noPersonalInfo to true by default (no personal info to check in basic validation)
    requirements.noPersonalInfo = true;

    // Check maximum length (128 characters to prevent DoS attacks)
    if (password.length > 128) {
      feedback.push('Must not exceed 128 characters');
      return {
        isValid: false,
        score: 0,
        feedback,
        requirements,
      };
    }

    // Calculate password strength score
    const score = this.calculateStrengthScore(password, requirements);
    const isValid =
      Object.values(requirements).every((req) => req) && feedback.length === 0;

    // Additional security checks
    if (this.hasRepeatedCharacters(password)) {
      feedback.push('Avoid excessive repeated characters');
    }

    if (this.hasKeyboardPatterns(password)) {
      feedback.push('Avoid keyboard patterns like qwerty or asdf');
    }

    return {
      isValid: isValid && feedback.length === 0,
      score,
      feedback,
      requirements,
    };
  }

  private checkCommonPatterns(password: string): boolean {
    const commonPatterns = [
      // Sequential patterns
      /123456|234567|345678|456789|567890|678901|789012|890123|901234/,
      /abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|hijklm|ijklmn|jklmno|klmnop|lmnopq|mnopqr|nopqrs|opqrst|pqrstu|qrstuv|rstuvw|stuvwx|tuvwxy|uvwxyz/i,

      // Repeated characters (3 or more in a row)
      /(.)\1{2,}/,

      // Common number patterns
      /1111|2222|3333|4444|5555|6666|7777|8888|9999|0000/,

      // Date patterns (full dates like 1990, 2024, etc. but not partial matches)
      /\b(19|20)\d{2}\b/,
    ];

    return !commonPatterns.some((pattern) => pattern.test(password));
  }

  private hasRepeatedCharacters(password: string): boolean {
    // Check for more than 2 consecutive identical characters
    return /(.)\1{2,}/.test(password);
  }

  private hasKeyboardPatterns(password: string): boolean {
    const keyboardPatterns = [
      /qwerty|qwertz|azerty/i,
      /asdf|asdfg|asdfgh/i,
      /zxcv|zxcvb|zxcvbn/i,
      /1qaz|2wsx|3edc|4rfv|5tgb|6yhn|7ujm|8ik|9ol|0p/i,
    ];

    return keyboardPatterns.some((pattern) => pattern.test(password));
  }

  private calculateStrengthScore(password: string, requirements: any): number {
    let score = 0;

    // Base requirements (each worth 0.5 points)
    if (requirements.minLength) score += 0.5;
    if (requirements.hasUppercase) score += 0.5;
    if (requirements.hasLowercase) score += 0.5;
    if (requirements.hasNumbers) score += 0.5;
    if (requirements.hasSpecialChars) score += 0.5;
    if (requirements.noCommonPatterns) score += 0.5;

    // Bonus points for additional security
    if (password.length >= 16) score += 0.5; // Extra length bonus
    if (/[^\w\s]/.test(password)) score += 0.5; // Extra special characters
    if (this.hasCharacterVariety(password)) score += 0.5; // Character variety

    return Math.min(Math.round(score), 4); // Cap at 4
  }

  private hasCharacterVariety(password: string): boolean {
    const charTypes = [
      /[a-z]/, // lowercase
      /[A-Z]/, // uppercase
      /\d/, // numbers
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, // common special chars
      /[~`]/, // additional special chars
    ];

    return charTypes.filter((type) => type.test(password)).length >= 4;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

// Common passwords list (top 100 most common passwords)
export const COMMON_PASSWORDS = [
  'password',
  '123456',
  '123456789',
  'welcome',
  'admin',
  'password123',
  'letmein',
  'monkey',
  'dragon',
  'qwerty',
  'abc123',
  'mustang',
  'michael',
  'shadow',
  'master',
  'jennifer',
  'jesus',
  'superman',
  'hello',
  'charlie',
  'shitbird',
  'princess',
  'mercedes',
  'klaster',
  '696969',
  'computer',
  'sunshine',
  'iloveyou',
  'michelle',
  'biteme',
  'liverpool',
  'mercedes',
  'soccer',
  'harley',
  'angel',
  'trustno1',
  'yamaha',
  'superman',
  'robert',
  'fuck',
  'danielle',
  'tigers',
  'jordan',
  'spongebob',
  'freedom',
  'daniel',
  'arsenal',
  'jessica',
  'blink182',
  'qazwsx',
  'aaaaaa',
  'elizabeth',
  'babygirl',
  'lovely',
  'amanda',
  'batista',
].map((p) => p.toLowerCase());
