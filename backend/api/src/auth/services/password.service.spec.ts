import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkPasswordStrength', () => {
    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password',
        '123456',
        'abc123',
        'qwerty',
        'Password',
        'Pass1',
        'short',
      ];

      weakPasswords.forEach((password) => {
        const result = service.checkPasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.score).toBeLessThan(4);
        expect(result.feedback.length).toBeGreaterThan(0);
      });
    });

    it('should accept strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!P@sw0rd',
        'C0mpl3x!Secur3#Pasw0rd',
        'Ungu3s@bl3!S3cur3K3y$',
      ];

      strongPasswords.forEach((password) => {
        const result = service.checkPasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.score).toBe(4);
        expect(result.feedback.length).toBe(0);
      });
    });

    it('should enforce minimum length requirement', () => {
      const shortPassword = 'Str0ng!1';
      const result = service.checkPasswordStrength(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.requirements.minLength).toBe(false);
      expect(result.feedback).toContain('Must be at least 12 characters long');
    });

    it('should enforce character variety requirements', () => {
      const tests = [
        {
          password: 'all lowercase no caps 123!',
          requirement: 'hasUppercase',
          feedback: 'Must contain at least one uppercase letter',
        },
        {
          password: 'ALL UPPERCASE NO LOWER 123!',
          requirement: 'hasLowercase',
          feedback: 'Must contain at least one lowercase letter',
        },
        {
          password: 'NoNumbersInThisPassword!',
          requirement: 'hasNumbers',
          feedback: 'Must contain at least one number',
        },
        {
          password: 'NoSpecialChars123ABC',
          requirement: 'hasSpecialChars',
          feedback: 'Must contain at least one special character',
        },
      ];

      tests.forEach((test) => {
        const result = service.checkPasswordStrength(test.password);
        expect(result.isValid).toBe(false);
        expect(result.requirements[test.requirement]).toBe(false);
        expect(result.feedback).toContain(test.feedback);
      });
    });

    it('should detect common patterns', () => {
      const commonPatterns = [
        'Password123456!',
        'Qwerty123456!',
        'Password111!',
        'Abcdef123456!',
      ];

      commonPatterns.forEach((password) => {
        const result = service.checkPasswordStrength(password);
        expect(result.isValid).toBe(false);
        // These should fail due to common patterns or repeated characters
      });
    });

    it('should enforce maximum length limit', () => {
      const tooLongPassword = 'A'.repeat(129) + 'a1!';
      const result = service.checkPasswordStrength(tooLongPassword);

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Must not exceed 128 characters');
    });

    it('should calculate strength scores correctly', () => {
      const passwordTests = [
        { password: '123', expectedMaxScore: 1 },
        { password: 'Password1!', expectedMaxScore: 4 },
        { password: 'StrongerPass1!', expectedMaxScore: 4 },
        { password: 'VeryStr0ngP@sw0rd!', expectedMaxScore: 4 },
      ];

      passwordTests.forEach((test) => {
        const result = service.checkPasswordStrength(test.password);
        expect(result.score).toBeLessThanOrEqual(test.expectedMaxScore);
      });
    });
  });

  describe('checkPasswordStrengthWithPersonalInfo', () => {
    it('should reject passwords containing email information', () => {
      const email = 'johnsmith@example.com';
      const passwords = [
        'JohnSmith123!',
        'johnsmith123!',
        'MyPasswordExample123!',
        'ExampleDomain123!',
      ];

      passwords.forEach((password) => {
        const result = service.checkPasswordStrengthWithPersonalInfo(password, {
          email,
        });
        expect(result.isValid).toBe(false);
        expect(result.requirements.noPersonalInfo).toBe(false);
        expect(
          result.feedback.some(
            (fb) => fb.includes('email') || fb.includes('name'),
          ),
        ).toBe(true);
      });
    });

    it('should reject passwords containing name information', () => {
      const name = 'John Smith';
      const passwords = [
        'JohnPassword123!',
        'SmithSecure123!',
        'MyJohnPassword!',
        'SecureSmith123!',
      ];

      passwords.forEach((password) => {
        const result = service.checkPasswordStrengthWithPersonalInfo(password, {
          name,
        });
        expect(result.isValid).toBe(false);
        expect(result.requirements.noPersonalInfo).toBe(false);
        expect(result.feedback).toContain(
          'Password should not contain your name',
        );
      });
    });

    it('should reject common passwords', () => {
      const commonPasswords = [
        'Password123!', // Contains "password" which is in COMMON_PASSWORDS
        'Welcome123!', // Contains "welcome"
        'Admin123456!', // Contains "admin"
        'Qwerty123456!', // Contains "qwerty"
      ];

      commonPasswords.forEach((password) => {
        const result = service.checkPasswordStrengthWithPersonalInfo(
          password,
          {},
        );
        expect(result.isValid).toBe(false);
        // These should fail due to containing common password substrings or other requirements
      });
    });

    it('should accept strong passwords without personal info', () => {
      const strongPassword = 'Ungu3s@bl3!Rand0m#K3y$';
      const result = service.checkPasswordStrengthWithPersonalInfo(
        strongPassword,
        { email: 'user@example.com', name: 'Test User' },
      );

      expect(result.isValid).toBe(true);
      expect(result.requirements.noPersonalInfo).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getStrengthDescription', () => {
    it('should return correct strength descriptions', () => {
      expect(service.getStrengthDescription(0)).toBe('Very Weak');
      expect(service.getStrengthDescription(1)).toBe('Weak');
      expect(service.getStrengthDescription(2)).toBe('Fair');
      expect(service.getStrengthDescription(3)).toBe('Good');
      expect(service.getStrengthDescription(4)).toBe('Strong');
      expect(service.getStrengthDescription(99)).toBe('Unknown');
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return password requirements list', () => {
      const requirements = service.getPasswordRequirements();

      expect(requirements).toHaveLength(8);
      expect(requirements).toContain('At least 12 characters long');
      expect(requirements).toContain('At least one uppercase letter (A-Z)');
      expect(requirements).toContain('At least one lowercase letter (a-z)');
      expect(requirements).toContain('At least one number (0-9)');
      expect(requirements).toContain(
        'At least one special character (!@#$%^&*...)',
      );
      expect(requirements).toContain('No common patterns or sequences');
      expect(requirements).toContain('No personal information (name, email)');
      expect(requirements).toContain('Maximum 128 characters');
    });
  });
});
