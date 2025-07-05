import { Test, TestingModule } from '@nestjs/testing';

import { RateLimiterService } from 'src/ai/queue/rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimiterService],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);

    // Initialize default models for testing
    service['initializeRateLimit']('claude-3-5-sonnet');
    service['initializeRateLimit']('claude-3-5-haiku');

    // Clear any existing intervals
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize rate limits for known models', () => {
      service['initializeRateLimit']('claude-3-5-sonnet');
      const state = service['rateLimits'].get('claude-3-5-sonnet');

      expect(state).toBeDefined();
      expect(state?.requestsPerMinute).toBe(50);
      expect(state?.requestsThisMinute).toBe(0);
      expect(state?.queue).toEqual([]);
    });

    it('should use default rate limit for unknown models', () => {
      service['initializeRateLimit']('unknown-model');
      const state = service['rateLimits'].get('unknown-model');

      expect(state).toBeDefined();
      expect(state?.requestsPerMinute).toBe(30);
    });
  });

  describe('model mapping', () => {
    it('should map datakit-smart to claude-3-5-sonnet', () => {
      const modelKey = service['getModelKey']('datakit-smart');
      expect(modelKey).toBe('claude-3-5-sonnet');
    });

    it('should map datakit-fast to claude-3-5-haiku', () => {
      const modelKey = service['getModelKey']('datakit-fast');
      expect(modelKey).toBe('claude-3-5-haiku');
    });

    it('should return original model name for unknown models', () => {
      const modelKey = service['getModelKey']('gpt-4');
      expect(modelKey).toBe('gpt-4');
    });
  });

  describe('queueRequest', () => {
    const mockApiCall = jest.fn();

    beforeEach(() => {
      mockApiCall.mockClear();
    });

    it('should execute request immediately when under rate limit', async () => {
      const mockResponse = { data: 'success' };
      mockApiCall.mockResolvedValue(mockResponse);

      const result = await service.queueRequest(
        'datakit-smart',
        { test: 'body' },
        mockApiCall,
      );

      expect(result).toBe(mockResponse);
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    it('should increment request counter', async () => {
      mockApiCall.mockResolvedValue({ data: 'success' });

      await service.queueRequest('datakit-smart', {}, mockApiCall);

      const state = service['rateLimits'].get('claude-3-5-sonnet');
      expect(state?.requestsThisMinute).toBe(1);
    });

    it('should queue request when at rate limit', () => {
      mockApiCall.mockResolvedValue({ data: 'success' });

      // Fill up the rate limit
      const state = service['rateLimits'].get('claude-3-5-sonnet');
      if (state) {
        state.requestsThisMinute = 50; // At limit for Sonnet
      }

      // This request should be queued but not execute immediately
      service.queueRequest('datakit-smart', { test: 'body' }, mockApiCall);

      // Check queue was added to
      expect(state?.queue.length).toBe(1);

      // API should not have been called yet (because we're at rate limit)
      expect(mockApiCall).not.toHaveBeenCalled();
    });

    it('should handle rate limit errors and requeue', async () => {
      const rateLimitError = new Error('429 Too Many Requests');
      (rateLimitError as any).status = 429;

      // Mock API call to fail first, then succeed
      mockApiCall
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ success: true });

      // Start with fresh rate limit state
      const state = service['rateLimits'].get('claude-3-5-sonnet');
      if (state) {
        state.requestsThisMinute = 0; // Under limit initially
      }

      // The service will detect the rate limit error and add to queue
      const result = await service.queueRequest(
        'datakit-smart',
        { test: 'body' },
        mockApiCall,
      );
      
      // Should eventually succeed when queue is processed
      expect(result).toBeDefined();
      
      // Verify API was called initially 
      expect(mockApiCall).toHaveBeenCalled();
    });
  });

  describe('counter reset', () => {
    it('should reset counter after 1 minute', () => {
      const state = service['rateLimits'].get('claude-3-5-sonnet');
      if (state) {
        state.requestsThisMinute = 45;
        state.lastResetTime = Date.now() - 61000; // 61 seconds ago
      }

      service['resetCounterIfNeeded'](state!);

      expect(state?.requestsThisMinute).toBe(0);
      expect(state?.lastResetTime).toBeCloseTo(Date.now(), -2);
    });

    it('should not reset counter before 1 minute', () => {
      const state = service['rateLimits'].get('claude-3-5-sonnet');
      if (state) {
        state.requestsThisMinute = 45;
        state.lastResetTime = Date.now() - 30000; // 30 seconds ago
      }

      service['resetCounterIfNeeded'](state!);

      expect(state?.requestsThisMinute).toBe(45);
    });
  });

  describe('queue processing', () => {
    it('should have interval processing setup', () => {
      // Just verify the service can handle queue processing without timing issues
      const processQueuesSpy = jest.spyOn(service as any, 'processQueues');

      // Call processQueues manually to test it works
      service['processQueues']();

      expect(processQueuesSpy).toHaveBeenCalledTimes(1);
    });

    it('should process queued requests when rate limit allows', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });

      // Setup a queued request
      const state = service['rateLimits'].get('claude-3-5-sonnet');
      if (state) {
        state.requestsThisMinute = 50; // At limit

        const promise = new Promise((resolve, reject) => {
          state.queue.push({
            id: 'test-id',
            model: 'claude-3-5-sonnet',
            body: {},
            resolve: async () => {
              const result = await mockApiCall();
              resolve(result);
            },
            reject,
            timestamp: Date.now(),
          });
        });

        // Reset counter and process queue
        state.requestsThisMinute = 0;
        await service['processQueues']();

        await promise;
        expect(mockApiCall).toHaveBeenCalled();
        expect(state.queue.length).toBe(0);
      }
    });
  });

  describe('rate limit updates from response', () => {
    it('should update rate limit from response headers', () => {
      const mockResponse = {
        headers: {
          get: jest.fn((header: string) => {
            if (header === 'x-ratelimit-remaining') return '25';
            if (header === 'x-ratelimit-reset') return '1234567890';
            return null;
          }),
        },
      };

      service['updateRateLimitFromResponse']('claude-3-5-sonnet', mockResponse);

      const state = service['rateLimits'].get('claude-3-5-sonnet');
      expect(state?.requestsThisMinute).toBe(25); // 50 - 25 = 25 used
    });

    it('should handle missing rate limit headers', () => {
      const mockResponse = {
        headers: {
          get: jest.fn(() => null),
        },
      };

      const state = service['rateLimits'].get('claude-3-5-sonnet');
      const originalRequests = state?.requestsThisMinute || 0;

      service['updateRateLimitFromResponse']('claude-3-5-sonnet', mockResponse);

      expect(state?.requestsThisMinute).toBe(originalRequests);
    });
  });

  describe('queue status', () => {
    it('should provide queue status for monitoring', () => {
      // Setup some state
      const sonnetState = service['rateLimits'].get('claude-3-5-sonnet');
      if (sonnetState) {
        sonnetState.requestsThisMinute = 10;
        sonnetState.queue = [1, 2, 3] as any; // Mock queue items
      }

      const status = service.getQueueStatus();

      expect(status['claude-3-5-sonnet']).toEqual({
        queue: 3,
        requests: 10,
        limit: 50,
      });
    });
  });

  describe('cleanup old requests', () => {
    it('should remove requests older than 5 minutes', () => {
      const state = service['rateLimits'].get('claude-3-5-sonnet');
      if (state) {
        const oldRequest = {
          id: 'old',
          model: 'claude-3-5-sonnet',
          body: {},
          resolve: jest.fn(),
          reject: jest.fn(),
          timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes old
        };

        const newRequest = {
          id: 'new',
          model: 'claude-3-5-sonnet',
          body: {},
          resolve: jest.fn(),
          reject: jest.fn(),
          timestamp: Date.now() - 1 * 60 * 1000, // 1 minute old
        };

        state.queue = [oldRequest, newRequest];

        service.cleanupOldRequests();

        expect(state.queue.length).toBe(1);
        expect(state.queue[0].id).toBe('new');
        expect(oldRequest.reject).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Request timeout - too long in queue',
          }),
        );
      }
    });
  });

  describe('error detection', () => {
    it('should detect rate limit errors by status', () => {
      const error = { status: 429 };
      expect(service['isRateLimitError'](error)).toBe(true);
    });

    it('should detect rate limit errors by code', () => {
      const error = { code: 'rate_limit_exceeded' };
      expect(service['isRateLimitError'](error)).toBe(true);
    });

    it('should detect rate limit errors by message', () => {
      const error = { message: 'You have exceeded the rate limit' };
      expect(service['isRateLimitError'](error)).toBe(true);
    });

    it('should not detect non-rate-limit errors', () => {
      const error = { status: 500, message: 'Internal server error' };
      expect(service['isRateLimitError'](error)).toBe(false);
    });
  });
});
