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

export interface PasswordRequirements {
  requirements: string[];
  strengthLevels: Array<{
    score: number;
    label: string;
    color: string;
  }>;
}

// Common passwords list (top 100 most common passwords)
const COMMON_PASSWORDS = [
  "password",
  "123456",
  "123456789",
  "welcome",
  "admin",
  "password123",
].map((p) => p.toLowerCase());

/**
 * Frontend password validator that mirrors the backend validation logic
 * Provides instant feedback without API calls
 */
export class PasswordValidator {
  /**
   * Validate password strength (basic validation without personal info)
   */
  static validatePassword(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    const requirements = {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumbers: false,
      hasSpecialChars: false,
      noCommonPatterns: false,
      noPersonalInfo: true, // Default to true for basic validation
    };

    // Check minimum length (12 characters based on OWASP recommendations)
    requirements.minLength = password.length >= 12;
    if (!requirements.minLength) {
      feedback.push("Must be at least 12 characters long");
    }

    // Check for uppercase letters
    requirements.hasUppercase = /[A-Z]/.test(password);
    if (!requirements.hasUppercase) {
      feedback.push("Must contain at least one uppercase letter");
    }

    // Check for lowercase letters
    requirements.hasLowercase = /[a-z]/.test(password);
    if (!requirements.hasLowercase) {
      feedback.push("Must contain at least one lowercase letter");
    }

    // Check for numbers
    requirements.hasNumbers = /\d/.test(password);
    if (!requirements.hasNumbers) {
      feedback.push("Must contain at least one number");
    }

    // Check for special characters
    requirements.hasSpecialChars =
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    if (!requirements.hasSpecialChars) {
      feedback.push("Must contain at least one special character");
    }

    // Check for common patterns
    requirements.noCommonPatterns = this.checkCommonPatterns(password);
    if (!requirements.noCommonPatterns) {
      feedback.push(
        "Contains common patterns (avoid sequences like 123, abc, or repeated characters)"
      );
    }

    // Check maximum length (128 characters to prevent DoS attacks)
    if (password.length > 128) {
      feedback.push("Must not exceed 128 characters");
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
      feedback.push("Avoid excessive repeated characters");
    }

    if (this.hasKeyboardPatterns(password)) {
      feedback.push("Avoid keyboard patterns like qwerty or asdf");
    }

    return {
      isValid: isValid && feedback.length === 0,
      score,
      feedback,
      requirements,
    };
  }

  /**
   * Validate password with personal information
   */
  static validatePasswordWithPersonalInfo(
    password: string,
    // personalInfo: { email?: string; name?: string }
  ): PasswordStrengthResult {
    const result = this.validatePassword(password);

    // TODO: 
    // Future refrences this might be good to have in place
    //
    // Check against personal information
    // const personalInfoCheck = this.validateAgainstPersonalInfo(
    //   password,
    //   personalInfo
    // );
    // result.requirements.noPersonalInfo = personalInfoCheck.isValid;

    // if (!personalInfoCheck.isValid) {
    //   result.feedback.push(...personalInfoCheck.feedback);
    //   result.isValid = false;
    // }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      result.feedback.push(
        "This password is too common. Please choose a more unique password."
      );
      result.isValid = false;
    }

    return result;
  }

  /**
   * Get password requirements
   */
  static getPasswordRequirements(): PasswordRequirements {
    return {
      requirements: [
        "At least 12 characters long",
        "At least one uppercase letter (A-Z)",
        "At least one lowercase letter (a-z)",
        "At least one number (0-9)",
        "At least one special character (!@#$%^&*...)",
        "No common patterns or sequences",
        "No personal information (name, email)",
        "Maximum 128 characters",
      ],
      strengthLevels: [
        { score: 0, label: "Very Weak", color: "#ff4444" },
        { score: 1, label: "Weak", color: "#ff8800" },
        { score: 2, label: "Fair", color: "#ffaa00" },
        { score: 3, label: "Good", color: "#88cc00" },
        { score: 4, label: "Strong", color: "#00cc44" },
      ],
    };
  }

  /**
   * Get strength description by score
   */
  static getStrengthDescription(score: number): string {
    const levels = this.getPasswordRequirements().strengthLevels;
    const level = levels.find((l) => l.score === score);
    return level?.label || "Unknown";
  }

  /**
   * Get strength color by score
   */
  static getStrengthColor(score: number): string {
    const levels = this.getPasswordRequirements().strengthLevels;
    const level = levels.find((l) => l.score === score);
    return level?.color || "#666";
  }

  // Private helper methods (mirror backend logic exactly)

  private static checkCommonPatterns(password: string): boolean {
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

  private static hasRepeatedCharacters(password: string): boolean {
    // Check for more than 2 consecutive identical characters
    return /(.)\1{2,}/.test(password);
  }

  private static hasKeyboardPatterns(password: string): boolean {
    const keyboardPatterns = [
      /qwerty|qwertz|azerty/i,
      /asdf|asdfg|asdfgh/i,
      /zxcv|zxcvb|zxcvbn/i,
      /1qaz|2wsx|3edc|4rfv|5tgb|6yhn|7ujm|8ik|9ol|0p/i,
    ];

    return keyboardPatterns.some((pattern) => pattern.test(password));
  }

  private static calculateStrengthScore(
    password: string,
    requirements: any
  ): number {
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

  private static hasCharacterVariety(password: string): boolean {
    const charTypes = [
      /[a-z]/, // lowercase
      /[A-Z]/, // uppercase
      /\d/, // numbers
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, // common special chars
      /[~`]/, // additional special chars
    ];

    return charTypes.filter((type) => type.test(password)).length >= 4;
  }

  private static validateAgainstPersonalInfo(
    password: string,
    personalInfo: { email?: string; name?: string }
  ): { isValid: boolean; feedback: string[] } {
    const feedback: string[] = [];
    const lowercasePassword = password.toLowerCase();

    // Check against email
    if (personalInfo.email) {
      const emailParts = personalInfo.email.toLowerCase().split("@");
      const localPart = emailParts[0];
      const domain = emailParts[1]?.split(".")[0];

      if (lowercasePassword.includes(localPart) && localPart.length > 2) {
        feedback.push("Password should not contain your email address");
      }

      if (domain && lowercasePassword.includes(domain) && domain.length > 2) {
        feedback.push("Password should not contain your email domain");
      }
    }

    // Check against name
    if (personalInfo.name) {
      const nameParts = personalInfo.name.toLowerCase().split(" ");
      for (const part of nameParts) {
        if (part.length > 2 && lowercasePassword.includes(part)) {
          feedback.push("Password should not contain your name");
          break;
        }
      }
    }

    return {
      isValid: feedback.length === 0,
      feedback,
    };
  }

  private static isCommonPassword(password: string): boolean {
    const lowercasePassword = password.toLowerCase();

    // Check for exact match
    if (COMMON_PASSWORDS.includes(lowercasePassword)) {
      return true;
    }

    // Check if password contains any common passwords as substrings
    return COMMON_PASSWORDS.some(
      (commonPassword) =>
        commonPassword.length >= 4 && lowercasePassword.includes(commonPassword)
    );
  }
}

// Export default for easier imports
export default PasswordValidator;
