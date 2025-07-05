import { Injectable } from '@nestjs/common';
import { Response } from 'express';

import { AIService } from './ai.service';

export interface StreamingContext {
  userId: string;
  model: string;
  prompt: string;
  actualInputTokens: number;
  actualOutputTokens: number;
  fullContent: string;
}

@Injectable()
export class StreamingService {
  constructor(private aiService: AIService) {}

  setupSSEHeaders(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // CORS headers should be handled by NestJS CORS middleware
    // Don't set them here as it can conflict
  }

  writeSSEData(res: Response, data: any): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force flush to ensure data is sent immediately
    const expressRes = res as any;
    if (expressRes.flush && typeof expressRes.flush === 'function') {
      expressRes.flush();
    }
  }

  writeSSEDone(res: Response): void {
    res.write('data: [DONE]\n\n');
    res.end();
  }

  async processAnthropicStream(
    anthropicResponse: any,
    res: Response,
    context: StreamingContext,
  ): Promise<void> {
    const reader = anthropicResponse.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              await this.finishStream(res, context);
              return;
            }

            try {
              const anthropicEvent = JSON.parse(data);
              await this.handleAnthropicEvent(anthropicEvent, res, context);
            } catch (parseError) {
              console.log('Failed to parse chunk:', data);
              continue;
            }
          }
        }
      }

      // If we reach here without [DONE], finish manually
      await this.finishStream(res, context);
    } finally {
      reader.releaseLock();
    }
  }

  private async handleAnthropicEvent(
    event: any,
    res: Response,
    context: StreamingContext,
  ): Promise<void> {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      const content = event.delta.text;
      context.fullContent += content;
      context.actualOutputTokens = Math.ceil(context.fullContent.length / 4);

      // Send in OpenAI streaming format
      const openAIChunk = {
        choices: [
          {
            delta: {
              content: content,
            },
            index: 0,
          },
        ],
        model: context.model,
      };

      this.writeSSEData(res, openAIChunk);
    } else if (event.type === 'message_start') {
      // Extract actual token usage from Anthropic
      if (event.message?.usage?.input_tokens) {
        context.actualInputTokens = event.message.usage.input_tokens;
      }
    }
  }

  private async finishStream(
    res: Response,
    context: StreamingContext,
  ): Promise<void> {
    try {
      // Record usage and get credit info
      const { creditsUsed, creditsRemaining } =
        await this.aiService.recordStreamingUsage(
          context.userId,
          context.model,
          context.actualInputTokens,
          context.actualOutputTokens,
          context.prompt,
          context.fullContent,
        );

      // Send final metadata in OpenAI format
      this.writeSSEData(res, {
        choices: [
          {
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: context.actualInputTokens,
          completion_tokens: context.actualOutputTokens,
          total_tokens: context.actualInputTokens + context.actualOutputTokens,
        },
        _datakit: {
          creditsUsed,
          creditsRemaining,
          model: context.model,
          tokensUsed: {
            input: context.actualInputTokens,
            output: context.actualOutputTokens,
          },
        },
      });

      this.writeSSEDone(res);
    } catch (error) {
      console.error('Error finishing stream:', error);
      // Don't try to send JSON response during streaming - headers already sent
      // Just write an error event and close the stream
      this.writeSSEData(res, {
        error: {
          message: 'Failed to complete streaming request',
          type: 'stream_error',
        },
      });
      this.writeSSEDone(res);
    }
  }
}
