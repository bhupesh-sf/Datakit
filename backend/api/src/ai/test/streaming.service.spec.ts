import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { StreamingService, StreamingContext } from 'src/ai/streaming.service';
import { AIService } from 'src/ai/ai.service';

describe('StreamingService', () => {
  let service: StreamingService;
  let aiService: AIService;

  const mockAIService = {
    recordStreamingUsage: jest.fn(),
  };

  const mockResponse = {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    flush: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        {
          provide: AIService,
          useValue: mockAIService,
        },
      ],
    }).compile();

    service = module.get<StreamingService>(StreamingService);
    aiService = module.get<AIService>(AIService);

    jest.clearAllMocks();
  });

  describe('setupSSEHeaders', () => {
    it('should set correct SSE headers', () => {
      service.setupSSEHeaders(mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Connection',
        'keep-alive',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Accel-Buffering',
        'no',
      );
    });

    it('should not set CORS headers', () => {
      service.setupSSEHeaders(mockResponse);

      const calls = (mockResponse.setHeader as jest.Mock).mock.calls;
      const corsHeaderSet = calls.some(([header]) =>
        header.toLowerCase().includes('access-control'),
      );
      expect(corsHeaderSet).toBe(false);
    });
  });

  describe('writeSSEData', () => {
    it('should write data in SSE format', () => {
      const data = { content: 'Hello', done: false };

      service.writeSSEData(mockResponse, data);

      expect(mockResponse.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(data)}\n\n`,
      );
    });

    it('should flush response if available', () => {
      const mockResponseWithFlush = {
        ...mockResponse,
        flush: jest.fn(),
      } as any;

      service.writeSSEData(mockResponseWithFlush, { test: 'data' });

      expect(mockResponseWithFlush.flush).toHaveBeenCalled();
    });

    it('should handle response without flush method', () => {
      const mockResponseNoFlush = {
        ...mockResponse,
        flush: undefined,
      } as unknown as Response;

      expect(() => {
        service.writeSSEData(mockResponseNoFlush, { test: 'data' });
      }).not.toThrow();
    });
  });

  describe('writeSSEDone', () => {
    it('should write [DONE] message and end response', () => {
      service.writeSSEDone(mockResponse);

      expect(mockResponse.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('processAnthropicStream', () => {
    let context: StreamingContext;
    let mockReader: any;

    beforeEach(() => {
      context = {
        userId: 'user-123',
        model: 'datakit-smart',
        prompt: 'Tell me a story',
        actualInputTokens: 10,
        actualOutputTokens: 0,
        fullContent: '',
      };

      mockReader = {
        read: jest.fn(),
        releaseLock: jest.fn(),
      };
    });

    const createMockStream = (chunks: string[]) => {
      let index = 0;
      mockReader.read.mockImplementation(async () => {
        if (index < chunks.length) {
          const chunk = chunks[index++];
          return {
            done: false,
            value: new TextEncoder().encode(chunk),
          };
        }
        return { done: true, value: undefined };
      });

      return {
        body: {
          getReader: () => mockReader,
        },
      };
    };

    it('should process content_block_delta events', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Once"}}\n',
        'data: {"type":"content_block_delta","delta":{"text":" upon"}}\n',
        'data: {"type":"content_block_delta","delta":{"text":" a time"}}\n',
        'data: [DONE]\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      // Check that content chunks were sent in OpenAI format
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"delta":{"content":"Once"}'),
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"delta":{"content":" upon"}'),
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"delta":{"content":" a time"}'),
      );

      // Check that full content was accumulated
      expect(context.fullContent).toBe('Once upon a time');
    });

    it('should handle message_start event for input tokens', async () => {
      const chunks = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":150}}}\n',
        'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n',
        'data: [DONE]\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      expect(context.actualInputTokens).toBe(150);
    });

    it('should convert Anthropic format to OpenAI format', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Test"}}\n',
      ];

      const mockStream = createMockStream(chunks);

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      const writeCall = (mockResponse.write as jest.Mock).mock.calls.find(
        (call) => call[0].includes('"delta":{"content":"Test"}'),
      );
      expect(writeCall).toBeDefined();

      const writtenData = JSON.parse(writeCall[0].replace('data: ', '').trim());
      expect(writtenData).toMatchObject({
        choices: [
          {
            delta: { content: 'Test' },
            index: 0,
          },
        ],
        model: 'datakit-smart',
      });
    });

    it('should handle [DONE] message', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Complete"}}\n',
        'data: [DONE]\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      // Check final metadata was sent
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"_datakit"'),
      );
      expect(mockResponse.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should update output token count during streaming', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"This is a longer text"}}\n',
        'data: [DONE]\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      // Output tokens should be estimated based on content length
      expect(context.actualOutputTokens).toBe(
        Math.ceil('This is a longer text'.length / 4),
      );
    });

    it('should handle malformed chunks gracefully', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Valid"}}\n',
        'data: {invalid json}\n',
        'data: {"type":"content_block_delta","delta":{"text":" chunk"}}\n',
        'data: [DONE]\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      // Should skip invalid chunk but process valid ones
      expect(context.fullContent).toBe('Valid chunk');
    });

    it('should finish stream if reader ends without [DONE]', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Incomplete"}}\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      // Should still finish the stream properly
      expect(aiService.recordStreamingUsage).toHaveBeenCalled();
      expect(mockResponse.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should release reader lock on completion', async () => {
      const chunks = ['data: [DONE]\n'];
      const mockStream = createMockStream(chunks);

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should handle errors during usage recording', async () => {
      const chunks = ['data: [DONE]\n'];
      const mockStream = createMockStream(chunks);

      mockAIService.recordStreamingUsage.mockRejectedValue(
        new Error('Database error'),
      );

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      // Should send error event
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"error"'),
      );
      expect(mockResponse.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should handle stream without body', async () => {
      const mockStreamNoBody = { body: undefined };

      await expect(
        service.processAnthropicStream(
          mockStreamNoBody as any,
          mockResponse,
          context,
        ),
      ).rejects.toThrow('No reader available');
    });

    it('should record usage with accumulated content', async () => {
      const chunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Part 1 "}}\n',
        'data: {"type":"content_block_delta","delta":{"text":"Part 2"}}\n',
        'data: [DONE]\n',
      ];

      const mockStream = createMockStream(chunks);
      mockAIService.recordStreamingUsage.mockResolvedValue({
        creditsUsed: 0.5,
        creditsRemaining: 99.5,
      });

      await service.processAnthropicStream(
        mockStream as any,
        mockResponse,
        context,
      );

      expect(aiService.recordStreamingUsage).toHaveBeenCalledWith(
        'user-123',
        'datakit-smart',
        expect.any(Number),
        expect.any(Number),
        'Tell me a story',
        'Part 1 Part 2',
      );
    });
  });
});
