import { Injectable, Logger } from '@nestjs/common';

interface QueuedRequest {
  id: string;
  model: string;
  body: any;
  resolve: (response: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface RateLimitState {
  requestsPerMinute: number;
  requestsThisMinute: number;
  lastResetTime: number;
  queue: QueuedRequest[];
  isProcessing: boolean;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly rateLimits: Map<string, RateLimitState> = new Map();

  // Conservative rate limits for Anthropic API
  private readonly DEFAULT_LIMITS = {
    'claude-3-5-sonnet': { requestsPerMinute: 50 }, // Conservative limit
    'claude-3-5-haiku': { requestsPerMinute: 100 }, // Higher limit for faster model
  };

  constructor() {
    // Process queues every 5 seconds
    setInterval(() => this.processQueues(), 5000);
  }

  async queueRequest(
    model: string,
    body: any,
    apiCall: () => Promise<any>,
  ): Promise<any> {
    const modelKey = this.getModelKey(model);

    if (!this.rateLimits.has(modelKey)) {
      this.initializeRateLimit(modelKey);
    }

    const state = this.rateLimits.get(modelKey)!;

    // Reset counter if a minute has passed
    this.resetCounterIfNeeded(state);

    // If under rate limit, execute immediately
    if (state.requestsThisMinute < state.requestsPerMinute) {
      state.requestsThisMinute++;
      try {
        const response = await apiCall();
        this.updateRateLimitFromResponse(modelKey, response);
        return response;
      } catch (error) {
        // If rate limited, add to queue
        if (this.isRateLimitError(error)) {
          this.logger.warn(`Rate limit hit for ${modelKey}, queuing request`);
          return this.addToQueue(modelKey, body, apiCall);
        }
        throw error;
      }
    }

    // Add to queue if over rate limit
    this.logger.debug(`Rate limit reached for ${modelKey}, queuing request`);
    return this.addToQueue(modelKey, body, apiCall);
  }

  private addToQueue(
    modelKey: string,
    body: any,
    apiCall: () => Promise<any>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const state = this.rateLimits.get(modelKey)!;
      const request: QueuedRequest = {
        id: Math.random().toString(36).substr(2, 9),
        model: modelKey,
        body,
        resolve: async (response) => {
          try {
            const result = await apiCall();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        reject,
        timestamp: Date.now(),
      };

      state.queue.push(request);
      this.logger.debug(
        `Queued request for ${modelKey}, queue size: ${state.queue.length}`,
      );
    });
  }

  private async processQueues(): Promise<void> {
    for (const [modelKey, state] of this.rateLimits.entries()) {
      if (state.queue.length === 0 || state.isProcessing) continue;

      this.resetCounterIfNeeded(state);

      if (state.requestsThisMinute < state.requestsPerMinute) {
        state.isProcessing = true;
        const request = state.queue.shift()!;

        try {
          state.requestsThisMinute++;
          const response = await request.resolve(undefined);
          this.updateRateLimitFromResponse(modelKey, response);

          this.logger.debug(
            `Processed queued request for ${modelKey}, remaining queue: ${state.queue.length}`,
          );
        } catch (error) {
          if (this.isRateLimitError(error)) {
            // Put request back at front of queue
            state.queue.unshift(request);
            state.requestsThisMinute = state.requestsPerMinute; // Block further requests
            this.logger.warn(
              `Rate limit still active for ${modelKey}, requeueing`,
            );
          } else {
            request.reject(error);
          }
        } finally {
          state.isProcessing = false;
        }
      }
    }
  }

  private initializeRateLimit(modelKey: string): void {
    const limit = this.DEFAULT_LIMITS[modelKey] || { requestsPerMinute: 30 };

    this.rateLimits.set(modelKey, {
      requestsPerMinute: limit.requestsPerMinute,
      requestsThisMinute: 0,
      lastResetTime: Date.now(),
      queue: [],
      isProcessing: false,
    });

    this.logger.debug(
      `Initialized rate limit for ${modelKey}: ${limit.requestsPerMinute} req/min`,
    );
  }

  private resetCounterIfNeeded(state: RateLimitState): void {
    const now = Date.now();
    if (now - state.lastResetTime >= 60000) {
      // 1 minute
      state.requestsThisMinute = 0;
      state.lastResetTime = now;
    }
  }

  private updateRateLimitFromResponse(modelKey: string, response: any): void {
    // Check for rate limit headers from Anthropic
    if (response && response.headers) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');

      if (remaining !== null) {
        const state = this.rateLimits.get(modelKey);
        if (state) {
          // Update our tracking based on actual API response
          state.requestsThisMinute = Math.max(
            0,
            state.requestsPerMinute - parseInt(remaining, 10),
          );

          this.logger.debug(
            `Updated rate limit for ${modelKey}: ${remaining} requests remaining`,
          );
        }
      }
    }
  }

  private isRateLimitError(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.code === 'rate_limit_exceeded' ||
      error?.message?.includes('rate limit') ||
      error?.message?.includes('429')
    );
  }

  private getModelKey(model: string): string {
    // Map DataKit models to their underlying Claude models for rate limiting
    switch (model) {
      case 'datakit-smart':
        return 'claude-3-5-sonnet';
      case 'datakit-fast':
        return 'claude-3-5-haiku';
      default:
        return model;
    }
  }

  // Public method to get queue status for monitoring
  getQueueStatus(): Record<
    string,
    { queue: number; requests: number; limit: number }
  > {
    const status: Record<
      string,
      { queue: number; requests: number; limit: number }
    > = {};

    for (const [modelKey, state] of this.rateLimits.entries()) {
      this.resetCounterIfNeeded(state);
      status[modelKey] = {
        queue: state.queue.length,
        requests: state.requestsThisMinute,
        limit: state.requestsPerMinute,
      };
    }

    return status;
  }

  // Method to clear old queued requests (optional cleanup)
  cleanupOldRequests(): void {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [modelKey, state] of this.rateLimits.entries()) {
      const initialLength = state.queue.length;
      state.queue = state.queue.filter((request) => {
        if (now - request.timestamp > maxAge) {
          request.reject(new Error('Request timeout - too long in queue'));
          return false;
        }
        return true;
      });

      if (state.queue.length !== initialLength) {
        this.logger.warn(
          `Cleaned up ${initialLength - state.queue.length} old requests for ${modelKey}`,
        );
      }
    }
  }
}
