import { Test, TestingModule } from '@nestjs/testing';
import { CreditsController } from 'src/credits/credits.controller';
import { CreditsService } from 'src/credits/credits.service';
import { EstimateCreditsDto } from 'src/credits/dto/estimate-credits.dto';

describe('CreditsController', () => {
  let controller: CreditsController;
  let creditsService: CreditsService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockRequest = {
    user: mockUser,
  };

  const mockCreditsService = {
    checkCredits: jest.fn(),
    calculateCredits: jest.fn(),
    getUserUsageHistory: jest.fn(),
    getUserUsageStats: jest.fn(),
    estimateCredits: jest.fn(),
    getRemainingCredits: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditsController],
      providers: [
        {
          provide: CreditsService,
          useValue: mockCreditsService,
        },
      ],
    }).compile();

    controller = module.get<CreditsController>(CreditsController);
    creditsService = module.get<CreditsService>(CreditsService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Controller instantiation', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('checkCredits', () => {
    it('should return hasCredits true when user has sufficient credits', async () => {
      const body = { estimatedCredits: 10.5 };
      mockCreditsService.checkCredits.mockResolvedValue(true);

      const result = await controller.checkCredits(mockRequest, body);

      expect(result).toEqual({ hasCredits: true });
      expect(mockCreditsService.checkCredits).toHaveBeenCalledWith(
        mockUser.id,
        10.5,
      );
    });

    it('should return hasCredits false when user has insufficient credits', async () => {
      const body = { estimatedCredits: 100.0 };
      mockCreditsService.checkCredits.mockResolvedValue(false);

      const result = await controller.checkCredits(mockRequest, body);

      expect(result).toEqual({ hasCredits: false });
      expect(mockCreditsService.checkCredits).toHaveBeenCalledWith(
        mockUser.id,
        100.0,
      );
    });

    it('should handle zero credits correctly', async () => {
      const body = { estimatedCredits: 0 };
      mockCreditsService.checkCredits.mockResolvedValue(true);

      const result = await controller.checkCredits(mockRequest, body);

      expect(result).toEqual({ hasCredits: true });
      expect(mockCreditsService.checkCredits).toHaveBeenCalledWith(
        mockUser.id,
        0,
      );
    });

    it('should handle service errors', async () => {
      const body = { estimatedCredits: 10.0 };
      const serviceError = new Error('Service unavailable');
      mockCreditsService.checkCredits.mockRejectedValue(serviceError);

      await expect(
        controller.checkCredits(mockRequest, body),
      ).rejects.toThrow('Service unavailable');
    });

    it('should handle decimal credit amounts', async () => {
      const body = { estimatedCredits: 7.25 };
      mockCreditsService.checkCredits.mockResolvedValue(true);

      const result = await controller.checkCredits(mockRequest, body);

      expect(result).toEqual({ hasCredits: true });
      expect(mockCreditsService.checkCredits).toHaveBeenCalledWith(
        mockUser.id,
        7.25,
      );
    });
  });

  describe('calculateCredits', () => {
    it('should calculate credits for valid input', async () => {
      const body = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 100,
        outputTokens: 50,
      };
      const expectedCredits = 12.5;
      
      mockCreditsService.calculateCredits.mockReturnValue(expectedCredits);

      const result = await controller.calculateCredits(body);

      expect(result).toEqual({ credits: expectedCredits });
      expect(mockCreditsService.calculateCredits).toHaveBeenCalledWith(
        'claude-3-sonnet-20240229',
        100,
        50,
      );
    });

    it('should handle different model IDs', async () => {
      const body = {
        modelId: 'gpt-4',
        inputTokens: 200,
        outputTokens: 100,
      };
      const expectedCredits = 25.0;
      
      mockCreditsService.calculateCredits.mockReturnValue(expectedCredits);

      const result = await controller.calculateCredits(body);

      expect(result).toEqual({ credits: expectedCredits });
      expect(mockCreditsService.calculateCredits).toHaveBeenCalledWith(
        'gpt-4',
        200,
        100,
      );
    });

    it('should handle zero tokens', async () => {
      const body = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 0,
        outputTokens: 0,
      };
      
      mockCreditsService.calculateCredits.mockReturnValue(0);

      const result = await controller.calculateCredits(body);

      expect(result).toEqual({ credits: 0 });
    });

    it('should handle large token counts', async () => {
      const body = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 10000,
        outputTokens: 5000,
      };
      const expectedCredits = 150.75;
      
      mockCreditsService.calculateCredits.mockReturnValue(expectedCredits);

      const result = await controller.calculateCredits(body);

      expect(result).toEqual({ credits: expectedCredits });
    });

    it('should handle service calculation errors', async () => {
      const body = {
        modelId: 'invalid-model',
        inputTokens: 100,
        outputTokens: 50,
      };
      
      mockCreditsService.calculateCredits.mockImplementation(() => {
        throw new Error('Unknown model');
      });

      await expect(controller.calculateCredits(body)).rejects.toThrow('Unknown model');
    });
  });

  describe('getUsageHistory', () => {
    it('should return usage history with default pagination', async () => {
      const mockUsages = [
        { id: 'usage-1', modelId: 'claude-3', creditsUsed: 10.5, createdAt: new Date() },
        { id: 'usage-2', modelId: 'gpt-4', creditsUsed: 15.0, createdAt: new Date() },
      ];
      const mockTotal = 25;

      mockCreditsService.getUserUsageHistory.mockResolvedValue([mockUsages, mockTotal]);

      const result = await controller.getUsageHistory(mockRequest);

      expect(result).toEqual({
        usages: mockUsages,
        total: mockTotal,
        limit: 50,
        offset: 0,
      });
      expect(mockCreditsService.getUserUsageHistory).toHaveBeenCalledWith(
        mockUser.id,
        50,
        0,
      );
    });

    it('should handle custom pagination parameters', async () => {
      const mockUsages = [
        { id: 'usage-3', modelId: 'claude-3', creditsUsed: 5.25, createdAt: new Date() },
      ];
      const mockTotal = 100;

      mockCreditsService.getUserUsageHistory.mockResolvedValue([mockUsages, mockTotal]);

      const result = await controller.getUsageHistory(mockRequest, 10, 20);

      expect(result).toEqual({
        usages: mockUsages,
        total: mockTotal,
        limit: 10,
        offset: 20,
      });
      expect(mockCreditsService.getUserUsageHistory).toHaveBeenCalledWith(
        mockUser.id,
        10,
        20,
      );
    });

    it('should handle empty usage history', async () => {
      mockCreditsService.getUserUsageHistory.mockResolvedValue([[], 0]);

      const result = await controller.getUsageHistory(mockRequest);

      expect(result).toEqual({
        usages: [],
        total: 0,
        limit: 50,
        offset: 0,
      });
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Database connection failed');
      mockCreditsService.getUserUsageHistory.mockRejectedValue(serviceError);

      await expect(
        controller.getUsageHistory(mockRequest),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle large pagination values', async () => {
      const mockUsages = [];
      const mockTotal = 1000;

      mockCreditsService.getUserUsageHistory.mockResolvedValue([mockUsages, mockTotal]);

      const result = await controller.getUsageHistory(mockRequest, 100, 500);

      expect(result).toEqual({
        usages: mockUsages,
        total: mockTotal,
        limit: 100,
        offset: 500,
      });
    });
  });

  describe('getUsageStats', () => {
    it('should return user usage statistics', async () => {
      const mockStats = {
        totalCreditsUsed: 125.75,
        totalRequests: 42,
        averageCreditsPerRequest: 2.99,
        mostUsedModel: 'claude-3-sonnet-20240229',
        currentPeriodUsage: 45.25,
      };

      mockCreditsService.getUserUsageStats.mockResolvedValue(mockStats);

      const result = await controller.getUsageStats(mockRequest);

      expect(result).toEqual(mockStats);
      expect(mockCreditsService.getUserUsageStats).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should handle new user with no stats', async () => {
      const emptyStats = {
        totalCreditsUsed: 0,
        totalRequests: 0,
        averageCreditsPerRequest: 0,
        mostUsedModel: null,
        currentPeriodUsage: 0,
      };

      mockCreditsService.getUserUsageStats.mockResolvedValue(emptyStats);

      const result = await controller.getUsageStats(mockRequest);

      expect(result).toEqual(emptyStats);
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Stats calculation failed');
      mockCreditsService.getUserUsageStats.mockRejectedValue(serviceError);

      await expect(
        controller.getUsageStats(mockRequest),
      ).rejects.toThrow('Stats calculation failed');
    });
  });

  describe('estimateCredits', () => {
    it('should estimate credits with all parameters', async () => {
      const estimateDto: EstimateCreditsDto = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 150,
        outputTokens: 75,
      };
      const expectedEstimate = 18.25;

      mockCreditsService.estimateCredits.mockResolvedValue(expectedEstimate);

      const result = await controller.estimateCredits(estimateDto);

      expect(result).toEqual({ estimatedCredits: expectedEstimate });
      expect(mockCreditsService.estimateCredits).toHaveBeenCalledWith(
        'claude-3-sonnet-20240229',
        150,
        75,
      );
    });

    it('should estimate credits with optional outputTokens', async () => {
      const estimateDto: EstimateCreditsDto = {
        modelId: 'gpt-4',
        inputTokens: 200,
      };
      const expectedEstimate = 20.0;

      mockCreditsService.estimateCredits.mockResolvedValue(expectedEstimate);

      const result = await controller.estimateCredits(estimateDto);

      expect(result).toEqual({ estimatedCredits: expectedEstimate });
      expect(mockCreditsService.estimateCredits).toHaveBeenCalledWith(
        'gpt-4',
        200,
        undefined,
      );
    });

    it('should handle zero input tokens', async () => {
      const estimateDto: EstimateCreditsDto = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 0,
        outputTokens: 50,
      };

      mockCreditsService.estimateCredits.mockResolvedValue(5.0);

      const result = await controller.estimateCredits(estimateDto);

      expect(result).toEqual({ estimatedCredits: 5.0 });
    });

    it('should handle service estimation errors', async () => {
      const estimateDto: EstimateCreditsDto = {
        modelId: 'unknown-model',
        inputTokens: 100,
      };

      const serviceError = new Error('Model not supported');
      mockCreditsService.estimateCredits.mockRejectedValue(serviceError);

      await expect(
        controller.estimateCredits(estimateDto),
      ).rejects.toThrow('Model not supported');
    });

    it('should handle large token estimates', async () => {
      const estimateDto: EstimateCreditsDto = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 50000,
        outputTokens: 25000,
      };
      const expectedEstimate = 750.5;

      mockCreditsService.estimateCredits.mockResolvedValue(expectedEstimate);

      const result = await controller.estimateCredits(estimateDto);

      expect(result).toEqual({ estimatedCredits: expectedEstimate });
    });
  });

  describe('getRemainingCredits', () => {
    it('should return remaining credits for user', async () => {
      const remainingCredits = 75.25;
      mockCreditsService.getRemainingCredits.mockResolvedValue(remainingCredits);

      const result = await controller.getRemainingCredits(mockRequest);

      expect(result).toEqual({ creditsRemaining: remainingCredits });
      expect(mockCreditsService.getRemainingCredits).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should handle zero remaining credits', async () => {
      mockCreditsService.getRemainingCredits.mockResolvedValue(0);

      const result = await controller.getRemainingCredits(mockRequest);

      expect(result).toEqual({ creditsRemaining: 0 });
    });

    it('should handle unlimited credits (negative value)', async () => {
      mockCreditsService.getRemainingCredits.mockResolvedValue(-1);

      const result = await controller.getRemainingCredits(mockRequest);

      expect(result).toEqual({ creditsRemaining: -1 });
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Failed to fetch credits');
      mockCreditsService.getRemainingCredits.mockRejectedValue(serviceError);

      await expect(
        controller.getRemainingCredits(mockRequest),
      ).rejects.toThrow('Failed to fetch credits');
    });

    it('should handle decimal credit amounts', async () => {
      const remainingCredits = 42.75;
      mockCreditsService.getRemainingCredits.mockResolvedValue(remainingCredits);

      const result = await controller.getRemainingCredits(mockRequest);

      expect(result).toEqual({ creditsRemaining: remainingCredits });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete credit workflow', async () => {
      // 1. Check remaining credits
      mockCreditsService.getRemainingCredits.mockResolvedValue(100.0);
      
      let remainingResult = await controller.getRemainingCredits(mockRequest);
      expect(remainingResult.creditsRemaining).toBe(100.0);

      // 2. Estimate credits for a request
      const estimateDto: EstimateCreditsDto = {
        modelId: 'claude-3-sonnet-20240229',
        inputTokens: 200,
        outputTokens: 100,
      };
      mockCreditsService.estimateCredits.mockResolvedValue(15.0);
      
      let estimateResult = await controller.estimateCredits(estimateDto);
      expect(estimateResult.estimatedCredits).toBe(15.0);

      // 3. Check if user has enough credits
      mockCreditsService.checkCredits.mockResolvedValue(true);
      
      let checkResult = await controller.checkCredits(mockRequest, { estimatedCredits: 15.0 });
      expect(checkResult.hasCredits).toBe(true);

      // 4. Get usage stats
      const mockStats = { totalCreditsUsed: 25.0, totalRequests: 5 };
      mockCreditsService.getUserUsageStats.mockResolvedValue(mockStats);
      
      let statsResult = await controller.getUsageStats(mockRequest);
      expect(statsResult).toEqual(mockStats);
    });

    it('should handle insufficient credits scenario', async () => {
      // User has low credits
      mockCreditsService.getRemainingCredits.mockResolvedValue(5.0);
      
      let remainingResult = await controller.getRemainingCredits(mockRequest);
      expect(remainingResult.creditsRemaining).toBe(5.0);

      // Estimate shows high cost
      mockCreditsService.estimateCredits.mockResolvedValue(25.0);
      const estimateDto: EstimateCreditsDto = {
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      };
      
      let estimateResult = await controller.estimateCredits(estimateDto);
      expect(estimateResult.estimatedCredits).toBe(25.0);

      // Check credits returns false
      mockCreditsService.checkCredits.mockResolvedValue(false);
      
      let checkResult = await controller.checkCredits(mockRequest, { estimatedCredits: 25.0 });
      expect(checkResult.hasCredits).toBe(false);
    });

    it('should handle concurrent requests properly', async () => {
      // Simulate multiple concurrent requests
      const promises = [];
      
      // Multiple credit checks
      mockCreditsService.checkCredits.mockResolvedValue(true);
      for (let i = 0; i < 5; i++) {
        promises.push(
          controller.checkCredits(mockRequest, { estimatedCredits: 10.0 })
        );
      }

      // Multiple remaining credit requests
      mockCreditsService.getRemainingCredits.mockResolvedValue(50.0);
      for (let i = 0; i < 3; i++) {
        promises.push(controller.getRemainingCredits(mockRequest));
      }

      const results = await Promise.all(promises);
      
      // All credit checks should return true
      expect(results.slice(0, 5)).toEqual(
        Array(5).fill({ hasCredits: true })
      );
      
      // All remaining credit calls should return 50.0
      expect(results.slice(5)).toEqual(
        Array(3).fill({ creditsRemaining: 50.0 })
      );
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors correctly', async () => {
      const testCases = [
        {
          method: 'checkCredits',
          args: [mockRequest, { estimatedCredits: 10 }],
          mockMethod: 'checkCredits',
        },
        {
          method: 'calculateCredits',
          args: [{ modelId: 'test', inputTokens: 100, outputTokens: 50 }],
          mockMethod: 'calculateCredits',
        },
        {
          method: 'getUsageHistory',
          args: [mockRequest],
          mockMethod: 'getUserUsageHistory',
        },
        {
          method: 'getUsageStats',
          args: [mockRequest],
          mockMethod: 'getUserUsageStats',
        },
        {
          method: 'estimateCredits',
          args: [{ modelId: 'test', inputTokens: 100 }],
          mockMethod: 'estimateCredits',
        },
        {
          method: 'getRemainingCredits',
          args: [mockRequest],
          mockMethod: 'getRemainingCredits',
        },
      ];

      for (const { method, args, mockMethod } of testCases) {
        const error = new Error(`${method} failed`);
        
        if (mockMethod === 'calculateCredits') {
          // calculateCredits throws synchronously, not a promise
          mockCreditsService[mockMethod].mockImplementation(() => {
            throw error;
          });
        } else {
          mockCreditsService[mockMethod].mockRejectedValue(error);
        }

        await expect(controller[method](...args)).rejects.toThrow(`${method} failed`);
        
        // Reset mock for next iteration
        mockCreditsService[mockMethod].mockReset();
      }
    });

    it('should handle malformed request data gracefully', async () => {
      // This would typically be handled by validation pipes in real scenarios
      const malformedBody = null;

      await expect(
        controller.checkCredits(mockRequest, malformedBody)
      ).rejects.toThrow();
    });
  });
});