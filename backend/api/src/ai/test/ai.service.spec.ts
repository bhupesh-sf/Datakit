import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AIService } from 'src/ai/ai.service';
import { CreditsService } from 'src/credits/credits.service';
import { RateLimiterService } from 'src/ai/queue/rate-limiter.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('AIService', () => {
  let service: AIService;
  let creditsService: CreditsService;
  let rateLimiterService: RateLimiterService;

  const mockCreditsService = {
    calculateCredits: jest.fn(),
    checkCredits: jest.fn(),
    recordUsage: jest.fn(),
    getRemainingCredits: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRateLimiterService = {
    queueRequest: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: CreditsService,
          useValue: mockCreditsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RateLimiterService,
          useValue: mockRateLimiterService,
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
    creditsService = module.get<CreditsService>(CreditsService);
    rateLimiterService = module.get<RateLimiterService>(RateLimiterService);

    // Setup default mocks
    mockConfigService.get.mockReturnValue('test-api-key');
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    const userId = 'user-123';
    const model = 'datakit-smart';
    const messages = [
      { role: 'user' as const, content: 'Hello, how are you?' },
    ];

    it('should pass validation when user has sufficient credits', async () => {
      mockCreditsService.calculateCredits.mockReturnValue(1.5);
      mockCreditsService.checkCredits.mockResolvedValue(true);

      await expect(
        service.validateRequest(userId, model, messages),
      ).resolves.not.toThrow();

      expect(creditsService.checkCredits).toHaveBeenCalledWith(userId, 1.5);
    });

    it('should throw BadRequestException when user has insufficient credits', async () => {
      mockCreditsService.calculateCredits.mockReturnValue(1.5);
      mockCreditsService.checkCredits.mockResolvedValue(false);

      await expect(
        service.validateRequest(userId, model, messages),
      ).rejects.toThrow(BadRequestException);
    });

    it('should correctly estimate input tokens from messages', async () => {
      mockCreditsService.calculateCredits.mockReturnValue(1.5);
      mockCreditsService.checkCredits.mockResolvedValue(true);

      await service.validateRequest(userId, model, messages);

      const expectedTokens = JSON.stringify(messages).length / 4;
      expect(creditsService.calculateCredits).toHaveBeenCalledWith(
        model,
        expectedTokens,
        1000, // default output tokens
      );
    });
  });

  describe('generateCompletion', () => {
    const userId = 'user-123';
    const request = {
      model: 'datakit-smart',
      messages: [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'What is 2+2?' },
      ],
      max_tokens: 100,
      temperature: 0.7,
    };

    const mockAnthropicResponse = {
      content: [{ text: '4' }],
      usage: { input_tokens: 50, output_tokens: 20 },
      stop_reason: 'end_turn',
    };

    beforeEach(() => {
      mockCreditsService.checkCredits.mockResolvedValue(true);
      mockCreditsService.calculateCredits.mockReturnValue(0.5);
      mockCreditsService.getRemainingCredits.mockResolvedValue(99.5);
      mockRateLimiterService.queueRequest.mockImplementation(
        async (model, body, apiCall) => apiCall(),
      );
    });

    it('should successfully generate completion for datakit-smart', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      const result = await service.generateCompletion(userId, request);

      expect(result).toEqual({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '4',
            },
            finish_reason: 'end_turn',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70,
        },
        model: 'datakit-smart',
        _datakit: {
          creditsUsed: 0.5,
          creditsRemaining: 99.5,
          model: 'datakit-smart',
          tokensUsed: {
            input: 50,
            output: 20,
          },
        },
      });
    });

    it('should handle system messages correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      await service.generateCompletion(userId, request);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.system).toBe('You are a helpful assistant');
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'What is 2+2?' },
      ]);
    });

    it('should route datakit-smart to Claude 3.5 Sonnet', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      await service.generateCompletion(userId, request);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should route datakit-fast to Claude 3.5 Haiku', async () => {
      const fastRequest = { ...request, model: 'datakit-fast' };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      await service.generateCompletion(userId, fastRequest);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('claude-3-5-haiku-20241022');
    });

    it('should record usage after successful completion', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      await service.generateCompletion(userId, request);

      expect(creditsService.recordUsage).toHaveBeenCalledWith(
        userId,
        'datakit-smart',
        'datakit',
        50, // actual input tokens
        20, // actual output tokens
        'What is 2+2?',
        '4',
      );
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid request' } }),
      });

      await expect(service.generateCompletion(userId, request)).rejects.toThrow(
        'DataKit AI error: 400 Bad Request - Invalid request',
      );
    });

    it('should use rate limiter for API calls', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse,
      });

      await service.generateCompletion(userId, request);

      expect(rateLimiterService.queueRequest).toHaveBeenCalledWith(
        'datakit-smart',
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
        }),
        expect.any(Function),
      );
    });
  });

  describe('generateStreamingCompletion', () => {
    const userId = 'user-123';
    const request = {
      model: 'datakit-smart',
      messages: [{ role: 'user' as const, content: 'Tell me a story' }],
      stream: true,
    };

    it('should validate request before streaming', async () => {
      mockCreditsService.checkCredits.mockResolvedValue(false);

      await expect(
        service.generateStreamingCompletion(userId, request),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return streaming response for datakit models', async () => {
      mockCreditsService.checkCredits.mockResolvedValue(true);

      const mockResponse = {
        ok: true,
        body: 'mock-stream-body',
      };

      mockRateLimiterService.queueRequest.mockResolvedValue(mockResponse);

      const result = await service.generateStreamingCompletion(userId, request);

      expect(result).toBe(mockResponse);
    });

    it('should throw error for unsupported streaming models', async () => {
      mockCreditsService.checkCredits.mockResolvedValue(true);

      const unsupportedRequest = {
        ...request,
        model: 'unsupported-model',
      };

      await expect(
        service.generateStreamingCompletion(userId, unsupportedRequest),
      ).rejects.toThrow('Unsupported model for streaming');
    });
  });

  describe('recordStreamingUsage', () => {
    const userId = 'user-123';

    it('should record usage and return credit information', async () => {
      mockCreditsService.recordUsage.mockResolvedValue(undefined);
      mockCreditsService.getRemainingCredits.mockResolvedValue(95.5);
      mockCreditsService.calculateCredits.mockReturnValue(4.5);

      const result = await service.recordStreamingUsage(
        userId,
        'datakit-smart',
        1000,
        3000,
        'Tell me a story',
        'Once upon a time...',
      );

      expect(result).toEqual({
        creditsUsed: 4.5,
        creditsRemaining: 95.5,
      });

      expect(creditsService.recordUsage).toHaveBeenCalledWith(
        userId,
        'datakit-smart',
        'datakit',
        1000,
        3000,
        'Tell me a story',
        'Once upon a time...',
      );
    });
  });

  describe('prepareClaudeMessages', () => {
    it('should extract system message and filter messages', () => {
      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant reply' },
        { role: 'user' as const, content: 'Another user message' },
      ];

      const result = service['prepareClaudeMessages'](messages);

      expect(result.systemMessage).toBe('System prompt');
      expect(result.messages).toEqual([
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant reply' },
        { role: 'user', content: 'Another user message' },
      ]);
    });

    it('should handle multiple system messages', () => {
      const messages = [
        { role: 'system' as const, content: 'First system' },
        { role: 'system' as const, content: 'Second system' },
        { role: 'user' as const, content: 'User message' },
      ];

      const result = service['prepareClaudeMessages'](messages);

      // Should use the last system message
      expect(result.systemMessage).toBe('Second system');
      expect(result.messages).toEqual([
        { role: 'user', content: 'User message' },
      ]);
    });

    it('should handle no system messages', () => {
      const messages = [{ role: 'user' as const, content: 'User message' }];

      const result = service['prepareClaudeMessages'](messages);

      expect(result.systemMessage).toBeUndefined();
      expect(result.messages).toEqual(messages);
    });
  });
});
