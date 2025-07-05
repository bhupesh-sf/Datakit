import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AIService, AIRequest } from 'src/ai/ai.service';
import { StreamingService, StreamingContext } from 'src/ai/streaming.service';

import { CreditsService } from 'src/credits/credits.service';

@Controller('ai')
export class AIController {
  constructor(
    private aiService: AIService,
    private streamingService: StreamingService,
    private creditsService: CreditsService,
  ) {}

  @Post('chat/completions/check')
  @UseGuards(JwtAuthGuard)
  async checkChatCompletions(@Request() req, @Body() body: AIRequest) {
    const { model, messages } = body;

    // Estimate tokens
    const estimatedInputTokens = JSON.stringify(messages).length / 4;
    const estimatedOutputTokens = 1000;
    const estimatedCredits = this.creditsService.calculateCredits(
      model,
      estimatedInputTokens,
      estimatedOutputTokens,
    );

    // Check if user has enough credits
    const hasCredits = await this.creditsService.checkCredits(
      req.user.id,
      estimatedCredits,
    );

    const remainingCredits = await this.creditsService.getRemainingCredits(
      req.user.id,
    );

    return {
      hasCredits,
      estimatedCredits,
      creditsRemaining: remainingCredits,
      canProceed: hasCredits,
    };
  }

  @Post('chat/completions')
  @UseGuards(JwtAuthGuard)
  async chatCompletions(
    @Request() req,
    @Body() body: AIRequest,
    @Res({ passthrough: false }) res: Response,
  ) {
    try {
      if (body.stream) {
        await this.handleStreamingRequest(req.user.id, body, res);
        return; // Don't return anything for streaming
      } else {
        return this.handleNonStreamingRequest(req.user.id, body, res);
      }
    } catch (error) {
      console.error('AI API Error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
      if (!res.headersSent) {
        res.status(400).json({
          error: 'AI API request failed',
          details: error.message,
        });
      }
    }
  }

  private async handleNonStreamingRequest(
    userId: string,
    body: AIRequest,
    res: Response,
  ): Promise<void> {
    try {
      const response = await this.aiService.generateCompletion(userId, body);
      res.json(response);
    } catch (error) {
      console.error('Non-streaming error:', error);
      res.status(400).json({ error: error.message || 'Request failed' });
    }
  }

  private async handleStreamingRequest(
    userId: string,
    body: AIRequest,
    res: Response,
  ): Promise<void> {
    try {
      // Setup SSE headers and status
      res.status(200); // Explicitly set 200 status for streaming
      this.streamingService.setupSSEHeaders(res);

      // Send initial connection message
      res.write(':ok\n\n');

      // Get streaming response from AI service
      const anthropicResponse =
        await this.aiService.generateStreamingCompletion(userId, body);

      // Create streaming context
      const context: StreamingContext = {
        userId,
        model: body.model,
        prompt: body.messages[body.messages.length - 1]?.content || '',
        actualInputTokens: JSON.stringify(body.messages).length / 4,
        actualOutputTokens: 0,
        fullContent: '',
      };

      // Process the stream
      await this.streamingService.processAnthropicStream(
        anthropicResponse,
        res,
        context,
      );
    } catch (error) {
      console.error('Streaming error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Streaming failed',
          details: error.message,
        });
      }
    }
  }
}
