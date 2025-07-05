import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ServiceAuthGuard } from '../service-auth.guard';

describe('ServiceAuthGuard', () => {
  let guard: ServiceAuthGuard;
  let configService: ConfigService;
  let mockExecutionContext: ExecutionContext;

  const mockRequest = {
    headers: {},
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceAuthGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<ServiceAuthGuard>(ServiceAuthGuard);
    configService = module.get<ConfigService>(ConfigService);

    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
        getNext: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    } as ExecutionContext;

    // Clear mocks and reset request
    jest.clearAllMocks();
    mockRequest.headers = {};
  });

  describe('Guard instantiation', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should implement CanActivate interface', () => {
      expect(guard.canActivate).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });
  });

  describe('canActivate method', () => {
    it('should return true when valid service key is provided', () => {
      const validServiceKey = 'valid-service-api-key';

      mockRequest.headers = {
        'x-datakit-service-key': validServiceKey,
      };

      mockConfigService.get.mockReturnValue(validServiceKey);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'DATAKIT_SERVICE_API_KEY',
      );
    });

    it('should throw UnauthorizedException when no service key is provided', () => {
      mockRequest.headers = {};
      mockConfigService.get.mockReturnValue('valid-service-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should throw UnauthorizedException when service key header is empty', () => {
      mockRequest.headers = {
        'x-datakit-service-key': '',
      };
      mockConfigService.get.mockReturnValue('valid-service-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should throw UnauthorizedException when expected key is not configured', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'some-key',
      };
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should throw UnauthorizedException when expected key is empty', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'some-key',
      };
      mockConfigService.get.mockReturnValue('');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should throw UnauthorizedException when service key is invalid', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'wrong-service-key',
      };
      mockConfigService.get.mockReturnValue('correct-service-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow(UnauthorizedException);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Invalid service API key');
    });
  });

  describe('Security scenarios', () => {
    it('should be case-sensitive for service keys', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'Valid-Service-Key',
      };
      mockConfigService.get.mockReturnValue('valid-service-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Invalid service API key');
    });

    it('should not allow partial key matches', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'valid-service',
      };
      mockConfigService.get.mockReturnValue('valid-service-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Invalid service API key');
    });

    it('should handle special characters in service keys', () => {
      const specialKey = 'service-key-!@#$%^&*()_+-=[]{}|;:,.<>?';

      mockRequest.headers = {
        'x-datakit-service-key': specialKey,
      };
      mockConfigService.get.mockReturnValue(specialKey);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle Unicode characters in service keys', () => {
      const unicodeKey = 'service-key-🔑🚀';

      mockRequest.headers = {
        'x-datakit-service-key': unicodeKey,
      };
      mockConfigService.get.mockReturnValue(unicodeKey);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle very long service keys', () => {
      const longKey = 'a'.repeat(1000);

      mockRequest.headers = {
        'x-datakit-service-key': longKey,
      };
      mockConfigService.get.mockReturnValue(longKey);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Header handling', () => {
    it('should handle different header casing', () => {
      // Headers are typically case-insensitive in HTTP
      mockRequest.headers = {
        'X-DATAKIT-SERVICE-KEY': 'valid-service-key',
      };
      mockConfigService.get.mockReturnValue('valid-service-key');

      // This test depends on how the HTTP framework handles header casing
      // In most cases, headers are normalized to lowercase
      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should only accept the exact header name', () => {
      mockRequest.headers = {
        'x-datakit-api-key': 'valid-service-key', // Wrong header name
      };
      mockConfigService.get.mockReturnValue('valid-service-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should handle multiple headers with same name', () => {
      // Some HTTP implementations might handle this differently
      mockRequest.headers = {
        'x-datakit-service-key': ['key1', 'key2'],
      };
      mockConfigService.get.mockReturnValue('key1');

      // This behavior depends on how the framework handles array headers
      // In most cases, this would fail validation
      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow(UnauthorizedException);
    });
  });

  describe('Configuration scenarios', () => {
    it('should handle null configuration value', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'some-key',
      };
      mockConfigService.get.mockReturnValue(null);

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should handle configuration throwing error', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'some-key',
      };
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Configuration error');
    });

    it('should call config service with correct key', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'test-key',
      };
      mockConfigService.get.mockReturnValue('test-key');

      guard.canActivate(mockExecutionContext);

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'DATAKIT_SERVICE_API_KEY',
      );
      expect(mockConfigService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace in service keys', () => {
      mockRequest.headers = {
        'x-datakit-service-key': ' valid-service-key ',
      };
      mockConfigService.get.mockReturnValue('valid-service-key');

      // The guard doesn't trim whitespace, so this should fail
      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Invalid service API key');
    });

    it('should handle empty string vs undefined difference', () => {
      // Test with empty string header
      mockRequest.headers = {
        'x-datakit-service-key': '',
      };
      mockConfigService.get.mockReturnValue('valid-key');

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');

      // Test with undefined header
      mockRequest.headers = {
        'x-datakit-service-key': undefined,
      };

      expect(() => {
        guard.canActivate(mockExecutionContext);
      }).toThrow('Service API key is required');
    });

    it('should handle numeric service keys', () => {
      const numericKey = '12345';

      mockRequest.headers = {
        'x-datakit-service-key': numericKey,
      };
      mockConfigService.get.mockReturnValue(numericKey);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Error message consistency', () => {
    it('should provide consistent error messages for missing keys', () => {
      const testCases = [
        { headers: {}, description: 'no header' },
        {
          headers: { 'x-datakit-service-key': '' },
          description: 'empty header',
        },
        {
          headers: { 'x-datakit-service-key': undefined },
          description: 'undefined header',
        },
      ];

      mockConfigService.get.mockReturnValue('valid-key');

      testCases.forEach(({ headers, description }) => {
        mockRequest.headers = headers;

        expect(() => {
          guard.canActivate(mockExecutionContext);
        }).toThrow('Service API key is required');
      });
    });

    it('should provide consistent error messages for missing config', () => {
      const testCases = [
        { configValue: undefined, description: 'undefined config' },
        { configValue: '', description: 'empty config' },
        { configValue: null, description: 'null config' },
      ];

      mockRequest.headers = {
        'x-datakit-service-key': 'some-key',
      };

      testCases.forEach(({ configValue, description }) => {
        mockConfigService.get.mockReturnValue(configValue);

        expect(() => {
          guard.canActivate(mockExecutionContext);
        }).toThrow('Service API key is required');
      });
    });
  });

  describe('Performance considerations', () => {
    it('should not perform expensive operations', () => {
      const validServiceKey = 'valid-service-key';

      mockRequest.headers = {
        'x-datakit-service-key': validServiceKey,
      };
      mockConfigService.get.mockReturnValue(validServiceKey);

      const start = Date.now();
      const result = guard.canActivate(mockExecutionContext);
      const duration = Date.now() - start;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should only call config service once per invocation', () => {
      mockRequest.headers = {
        'x-datakit-service-key': 'test-key',
      };
      mockConfigService.get.mockReturnValue('test-key');

      guard.canActivate(mockExecutionContext);

      expect(mockConfigService.get).toHaveBeenCalledTimes(1);
    });
  });
});
