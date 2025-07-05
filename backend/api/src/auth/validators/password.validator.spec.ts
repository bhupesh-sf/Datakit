import { validate } from 'class-validator';
import {
  IsStrongPasswordConstraint,
  IsStrongPassword,
} from './password.validator';

describe('IsStrongPasswordConstraint', () => {
  let validator: IsStrongPasswordConstraint;

  beforeEach(() => {
    validator = new IsStrongPasswordConstraint();
  });

  describe('validate', () => {
    it('should return true for strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!P@sw0rd',
        'C0mpl3x!Secur3#Pasw0rd',
        'Ungu3s@bl3!S3cur3K3y$',
      ];

      strongPasswords.forEach((password) => {
        expect(validator.validate(password, {} as any)).toBe(true);
      });
    });

    it('should return false for weak passwords', () => {
      const weakPasswords = [
        'password',
        '123456789',
        'Password',
        'Pass123',
        'short',
        'no-uppercase-123!',
        'NO-LOWERCASE-123!',
        'NoNumbers!',
        'NoSpecialChars123',
      ];

      weakPasswords.forEach((password) => {
        expect(validator.validate(password, {} as any)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate all requirements for a strong password', () => {
      const strongPassword = 'MyStr0ng!P@sw0rd';
      const result = validator.validatePassword(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(4);
      expect(result.feedback).toHaveLength(0);
      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumbers).toBe(true);
      expect(result.requirements.hasSpecialChars).toBe(true);
      expect(result.requirements.noCommonPatterns).toBe(true);
    });

    it('should provide specific feedback for failed requirements', () => {
      const weakPassword = 'pass';
      const result = validator.validatePassword(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Must be at least 12 characters long');
      expect(result.feedback).toContain(
        'Must contain at least one uppercase letter',
      );
      expect(result.feedback).toContain('Must contain at least one number');
      expect(result.feedback).toContain(
        'Must contain at least one special character',
      );
    });

    it('should detect sequential patterns', () => {
      const passwords = [
        'MyPassword123456!',
        'SecureAbcdef123!',
        'TestPassword111!',
      ];

      passwords.forEach((password) => {
        const result = validator.validatePassword(password);
        expect(result.requirements.noCommonPatterns).toBe(false);
        expect(result.feedback).toContain(
          'Contains common patterns (avoid sequences like 123, abc, or repeated characters)',
        );
      });
    });

    it('should detect keyboard patterns', () => {
      const keyboardPasswords = [
        'MyQwerty123456!',
        'SecureAsdf123!',
        'Test1qaz2wsx!',
      ];

      keyboardPasswords.forEach((password) => {
        const result = validator.validatePassword(password);
        expect(result.feedback).toContain(
          'Avoid keyboard patterns like qwerty or asdf',
        );
      });
    });

    it('should detect repeated characters', () => {
      const repeatedPasswords = [
        'MyPassword111!',
        'SecureAAAPass1!',
        'TestPasssss123!',
      ];

      repeatedPasswords.forEach((password) => {
        const result = validator.validatePassword(password);
        expect(result.feedback).toContain(
          'Avoid excessive repeated characters',
        );
      });
    });

    it('should reject passwords that are too long', () => {
      const tooLongPassword = 'A'.repeat(130) + 'a1!';
      const result = validator.validatePassword(tooLongPassword);

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Must not exceed 128 characters');
    });

    it('should calculate strength scores correctly', () => {
      const tests = [
        { password: '123', expectedMaxScore: 1 },
        { password: 'Password1!', expectedMaxScore: 4 },
        { password: 'StrongerPass1!', expectedMaxScore: 4 },
        { password: 'VeryStr0ngP@sw0rd!', expectedScore: 4 },
      ];

      tests.forEach((test) => {
        const result = validator.validatePassword(test.password);
        if ('expectedScore' in test) {
          expect(result.score).toBe(test.expectedScore);
        } else {
          expect(result.score).toBeLessThanOrEqual(test.expectedMaxScore);
        }
      });
    });
  });

  describe('defaultMessage', () => {
    it('should return appropriate error messages', () => {
      const args = {
        value: 'weak',
        property: 'password',
        object: {},
        constraints: [],
        targetName: 'TestClass',
      };

      const message = validator.defaultMessage(args);
      expect(message).toContain('Password does not meet security requirements');
    });

    it('should handle empty password', () => {
      const args = {
        value: '',
        property: 'password',
        object: {},
        constraints: [],
        targetName: 'TestClass',
      };

      const message = validator.defaultMessage(args);
      expect(message).toBe('Password is required');
    });
  });
});

describe('Password Validator Integration', () => {
  class TestDto {
    @IsStrongPassword()
    password: string;
  }

  it('should integrate with class-validator', async () => {
    const dto = new TestDto();
    dto.password = 'weak';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toBeDefined();
  });

  it('should pass validation with strong password', async () => {
    const dto = new TestDto();
    dto.password = 'MyStr0ng!P@sw0rd';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
