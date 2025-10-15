import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { RateLimiterService } from './queue/rate-limiter.service';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIRequest {
  model: string;
  messages: AIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIResponse {
  choices: Array<{
    message?: {
      role: string;
      content: string;
    };
    delta?: {
      content?: string;
    };
    finish_reason?: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  _datakit?: {
    creditsUsed: number;
    creditsRemaining: number;
    model: string;
    tokensUsed: {
      input: number;
      output: number;
    };
  };
}

@Injectable()
export class AIService {
  constructor(
    private configService: ConfigService,
    private creditsService: CreditsService,
    private rateLimiterService: RateLimiterService,
  ) {}

  // Validate if user can make the request
  async validateRequest(
    userId: string,
    model: string,
    messages: AIMessage[],
  ): Promise<void> {
    const estimatedInputTokens = JSON.stringify(messages).length / 4;
    const estimatedOutputTokens = 1000;
    const estimatedCredits = this.creditsService.calculateCredits(
      model,
      estimatedInputTokens,
      estimatedOutputTokens,
    );

    const hasCredits = await this.creditsService.checkCredits(
      userId,
      estimatedCredits,
    );
    if (!hasCredits) {
      throw new BadRequestException('Insufficient credits');
    }
  }

  // Generate non-streaming completion
  async generateCompletion(
    userId: string,
    request: AIRequest,
  ): Promise<AIResponse> {
    await this.validateRequest(userId, request.model, request.messages);

    const estimatedInputTokens = JSON.stringify(request.messages).length / 4;
    let response: any;
    let actualInputTokens = estimatedInputTokens;
    let actualOutputTokens = 0;

    // Route to appropriate provider
    if (request.model.startsWith('datakit-')) {
      response = await this.callDatakitAI(request);
    } else {
      throw new BadRequestException('Unsupported model');
    }

    // Extract actual token usage
    actualInputTokens =
      response.usage?.prompt_tokens ||
      response.usage?.input_tokens ||
      estimatedInputTokens;
    actualOutputTokens =
      response.usage?.completion_tokens || response.usage?.output_tokens || 0;

    // Record usage
    await this.creditsService.recordUsage(
      userId,
      request.model,
      'datakit',
      actualInputTokens,
      actualOutputTokens,
      request.messages[request.messages.length - 1]?.content,
      response.choices?.[0]?.message?.content || response.content?.[0]?.text,
    );

    // Add credit information
    const remainingCredits =
      await this.creditsService.getRemainingCredits(userId);
    const creditsUsed = this.creditsService.calculateCredits(
      request.model,
      actualInputTokens,
      actualOutputTokens,
    );

    return {
      ...response,
      _datakit: {
        creditsUsed,
        creditsRemaining: remainingCredits,
        model: response.model || request.model,
        tokensUsed: {
          input: actualInputTokens,
          output: actualOutputTokens,
        },
      },
    };
  }

  // Generate streaming completion
  async generateStreamingCompletion(
    userId: string,
    request: AIRequest,
  ): Promise<any> {
    await this.validateRequest(userId, request.model, request.messages);

    if (request.model.startsWith('datakit-')) {
      return this.callDatakitAIStream(request);
    } else {
      throw new BadRequestException('Unsupported model for streaming');
    }
  }

  // Handle post-streaming credit recording
  async recordStreamingUsage(
    userId: string,
    model: string,
    actualInputTokens: number,
    actualOutputTokens: number,
    prompt: string,
    completion: string,
  ): Promise<{ creditsUsed: number; creditsRemaining: number }> {
    await this.creditsService.recordUsage(
      userId,
      model,
      'datakit',
      actualInputTokens,
      actualOutputTokens,
      prompt,
      completion,
    );

    const remainingCredits =
      await this.creditsService.getRemainingCredits(userId);
    const creditsUsed = this.creditsService.calculateCredits(
      model,
      actualInputTokens,
      actualOutputTokens,
    );

    return {
      creditsUsed: creditsUsed,
      creditsRemaining: remainingCredits,
    };
  }

  private async callDatakitAI(request: AIRequest): Promise<any> {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY');

    let anthropicModel: string;
    if (request.model === 'datakit-smart') {
      anthropicModel = 'claude-3-5-sonnet-20241022';
    } else if (request.model === 'datakit-fast') {
      anthropicModel = 'claude-3-5-haiku-20241022';
    } else {
      throw new Error(`Unknown DataKit AI model: ${request.model}`);
    }

    const { messages, systemMessage } = this.prepareClaudeMessages(
      request.messages,
    );
    const anthropicBody = {
      model: anthropicModel,
      messages,
      system: systemMessage,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature || 0.1,
    };

    return this.rateLimiterService.queueRequest(
      request.model,
      anthropicBody,
      async () => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(anthropicBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Anthropic API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          throw new Error(
            `DataKit AI error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`,
          );
        }

        const data = await response.json();

        // Convert to OpenAI format
        return {
          choices: [
            {
              message: {
                role: 'assistant',
                content: data.content[0].text,
              },
              finish_reason: data.stop_reason,
            },
          ],
          usage: {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
          },
          model: request.model,
        };
      },
    );
  }

  private async callDatakitAIStream(request: AIRequest): Promise<any> {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY');

    let anthropicModel: string;
    if (request.model === 'datakit-smart') {
      anthropicModel = 'claude-sonnet-4-5-20250929';
    } else if (request.model === 'datakit-fast') {
      anthropicModel = 'claude-sonnet-4-20250514';
    } else {
      throw new Error(`Unknown DataKit AI model: ${request.model}`);
    }

    const { messages, systemMessage } = this.prepareClaudeMessages(
      request.messages,
    );
    const anthropicBody = {
      model: anthropicModel,
      messages,
      system: systemMessage,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature || 0.1,
      stream: true,
    };

    return this.rateLimiterService.queueRequest(
      request.model,
      anthropicBody,
      async () => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(anthropicBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Anthropic Streaming API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            body: anthropicBody,
          });
          throw new Error(
            `DataKit AI Stream error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`,
          );
        }

        return response;
      },
    );
  }

  private prepareClaudeMessages(messages: AIMessage[]): {
    messages: AIMessage[];
    systemMessage?: string;
  } {
    let systemMessage: string | undefined;
    const filteredMessages: AIMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else {
        filteredMessages.push(message);
      }
    }

    return {
      messages: filteredMessages,
      systemMessage,
    };
  }
}
