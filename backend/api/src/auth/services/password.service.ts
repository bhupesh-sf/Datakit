import { Injectable } from '@nestjs/common';
import {
  IsStrongPasswordConstraint,
  PasswordStrengthResult,
  COMMON_PASSWORDS,
} from '../validators/password.validator';

@Injectable()
export class PasswordService {
  private passwordValidator = new IsStrongPasswordConstraint();

  /**
   * Check password strength without personal information validation
   */
  checkPasswordStrength(password: string): PasswordStrengthResult {
    return this.passwordValidator.validatePassword(password);
  }

  /**
   * Check password strength with personal information validation
   */
  checkPasswordStrengthWithPersonalInfo(
    password: string,
    personalInfo: { email?: string; name?: string },
  ): PasswordStrengthResult {
    const result = this.passwordValidator.validatePassword(password);

    // Check against personal information
    const personalInfoCheck = this.validateAgainstPersonalInfo(
      password,
      personalInfo,
    );
    result.requirements.noPersonalInfo = personalInfoCheck.isValid;

    if (!personalInfoCheck.isValid) {
      result.feedback.push(...personalInfoCheck.feedback);
      result.isValid = false;
    }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      result.feedback.push(
        'This password is too common. Please choose a more unique password.',
      );
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate password against personal information
   */
  private validateAgainstPersonalInfo(
    password: string,
    personalInfo: { email?: string; name?: string },
  ): { isValid: boolean; feedback: string[] } {
    const feedback: string[] = [];
    const lowercasePassword = password.toLowerCase();

    // Check against email
    if (personalInfo.email) {
      const emailParts = personalInfo.email.toLowerCase().split('@');
      const localPart = emailParts[0];
      const domain = emailParts[1]?.split('.')[0];

      if (lowercasePassword.includes(localPart) && localPart.length > 2) {
        feedback.push('Password should not contain your email address');
      }

      if (domain && lowercasePassword.includes(domain) && domain.length > 2) {
        feedback.push('Password should not contain your email domain');
      }
    }

    // Check against name
    if (personalInfo.name) {
      const nameParts = personalInfo.name.toLowerCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 2 && lowercasePassword.includes(part)) {
          feedback.push('Password should not contain your name');
          break;
        }
      }
    }

    return {
      isValid: feedback.length === 0,
      feedback,
    };
  }

  /**
   * Check if password is in common passwords list or contains common passwords
   */
  private isCommonPassword(password: string): boolean {
    const lowercasePassword = password.toLowerCase();

    // Check for exact match
    if (COMMON_PASSWORDS.includes(lowercasePassword)) {
      return true;
    }

    // Check if password contains any common passwords as substrings
    return COMMON_PASSWORDS.some(
      (commonPassword) =>
        commonPassword.length >= 4 &&
        lowercasePassword.includes(commonPassword),
    );
  }

  /**
   * Generate password strength score description
   */
  getStrengthDescription(score: number): string {
    switch (score) {
      case 0:
        return 'Very Weak';
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get password requirements text
   */
  getPasswordRequirements(): string[] {
    return [
      'At least 12 characters long',
      'At least one uppercase letter (A-Z)',
      'At least one lowercase letter (a-z)',
      'At least one number (0-9)',
      'At least one special character (!@#$%^&*...)',
      'No common patterns or sequences',
      'No personal information (name, email)',
      'Maximum 128 characters',
    ];
  }
}
