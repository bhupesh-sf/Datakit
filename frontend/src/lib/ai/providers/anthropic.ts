import { 
  AIMessage, 
  AIResponse, 
  AIStreamResponse,
  SQLGenerationRequest,
  SQLGenerationResponse,
  DataAnalysisRequest,
  DataAnalysisResponse
} from "../types";
import { createSystemPrompt, createSQLPrompt, createDataAnalysisPrompt } from "../prompts/sqlPrompts";
import { SafeAPIProvider, handleCORSError } from "./safeApiProvider";

export class AnthropicProvider {
  private apiKey: string;
  private model: string;
  private apiProvider: SafeAPIProvider;

  constructor(apiKey: string, model: string = 'claude-3-sonnet-20240229') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiProvider = new SafeAPIProvider('https://api.anthropic.com/v1', {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Anthropic doesn't have a simple validation endpoint, so we'll try a minimal request
      const response = await this.generateCompletion([
        { role: 'user', content: 'Hello' }
      ], { maxTokens: 10 });
      return true;
    } catch (error) {
      console.error('Anthropic API key validation failed:', error);
      return false;
    }
  }

  async generateCompletion(
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<AIResponse> {
    try {
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertMessages(messages);
      
      const response = await this.apiProvider.makeRequest('/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          messages: anthropicMessages.messages,
          system: anthropicMessages.system,
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.1,
          stream: options?.stream || false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
    
      return {
        content: data.content?.[0]?.text || '',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
        model: data.model,
        finishReason: data.stop_reason,
      };
    } catch (error) {
      // Handle CORS and other API errors
      throw handleCORSError(error as Error);
    }
  }

  async generateStreamCompletion(
    messages: AIMessage[],
    onChunk: (chunk: AIStreamResponse) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    try {
      const anthropicMessages = this.convertMessages(messages);
      
      const response = await this.apiProvider.makeRequest('/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          messages: anthropicMessages.messages,
          system: anthropicMessages.system,
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.1,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
      }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    let content = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onChunk({ content, done: true });
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

        for (const line of lines) {
          const data = line.replace('data: ', '');
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              content += parsed.delta.text;
              onChunk({ content, done: false });
            } else if (parsed.type === 'message_stop') {
              onChunk({ content, done: true });
              return;
            }
          } catch (parseError) {
            // Skip invalid JSON chunks
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    } catch (error) {
      // Handle CORS and other API errors
      throw handleCORSError(error as Error);
    }
  }

  async generateSQL(request: SQLGenerationRequest): Promise<SQLGenerationResponse> {
    const systemPrompt = createSystemPrompt(request.context);
    const userPrompt = createSQLPrompt(request.prompt, request.context, {
      includeExplanation: request.includeExplanation,
      maxRows: request.maxRows,
    });

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.1 });
    
    // Extract SQL from the response
    const sql = this.extractSQL(response.content);
    const explanation = this.extractExplanation(response.content);
    
    return {
      sql,
      explanation,
      confidence: 0.9, // TODO: Implement actual confidence scoring
      warnings: this.extractWarnings(response.content),
    };
  }

  async analyzeData(request: DataAnalysisRequest): Promise<DataAnalysisResponse> {
    const userPrompt = createDataAnalysisPrompt(request.prompt, request.context, request.data);
    
    const messages: AIMessage[] = [
      { 
        role: 'system', 
        content: 'You are a data analyst expert. Provide clear, actionable insights with specific recommendations.' 
      },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    return {
      analysis: response.content,
      insights: this.extractInsights(response.content),
      suggestions: this.extractSuggestions(response.content),
    };
  }

  private convertMessages(messages: AIMessage[]): { 
    system?: string; 
    messages: Array<{ role: 'user' | 'assistant'; content: string }> 
  } {
    const systemMessage = messages.find(msg => msg.role === 'system');
    const conversationMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    return {
      system: systemMessage?.content,
      messages: conversationMessages,
    };
  }

  private extractSQL(content: string): string {
    // Extract SQL from code blocks
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/i);
    if (sqlMatch) {
      return sqlMatch[1].trim();
    }
    
    // Fallback: look for SQL keywords
    const lines = content.split('\n');
    const sqlLines = lines.filter(line => 
      /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)/i.test(line.trim())
    );
    
    if (sqlLines.length > 0) {
      return sqlLines.join('\n').trim();
    }
    
    return content.trim();
  }

  private extractExplanation(content: string): string | undefined {
    // Look for explanation sections
    const explanationMatch = content.match(/explanation:?\s*(.*?)(?=\n\n|\n```|$)/is);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    
    // If no explicit explanation section, return the non-SQL parts
    const nonSqlParts = content.replace(/```sql[\s\S]*?```/gi, '').trim();
    if (nonSqlParts && nonSqlParts !== content.trim()) {
      return nonSqlParts;
    }
    
    return undefined;
  }

  private extractWarnings(content: string): string[] {
    const warnings: string[] = [];
    const warningPatterns = [
      /warning:?\s*(.*?)(?=\n|$)/gi,
      /note:?\s*(.*?)(?=\n|$)/gi,
      /performance:?\s*(.*?)(?=\n|$)/gi,
    ];
    
    warningPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        warnings.push(match[1].trim());
      }
    });
    
    return warnings;
  }

  private extractInsights(content: string): Array<{
    type: 'trend' | 'pattern' | 'anomaly' | 'summary';
    title: string;
    description: string;
    confidence: number;
  }> {
    // This is a simplified extraction - in a real implementation,
    // you'd want more sophisticated parsing
    const insights = [];
    const sections = content.split('\n').filter(line => line.trim());
    
    for (const section of sections) {
      if (section.includes('trend') || section.includes('pattern')) {
        insights.push({
          type: 'trend' as const,
          title: 'Data Trend',
          description: section.trim(),
          confidence: 0.8,
        });
      }
    }
    
    return insights;
  }

  private extractSuggestions(content: string): string[] {
    const suggestions: string[] = [];
    const suggestionPatterns = [
      /recommendation:?\s*(.*?)(?=\n|$)/gi,
      /suggest:?\s*(.*?)(?=\n|$)/gi,
      /consider:?\s*(.*?)(?=\n|$)/gi,
    ];
    
    suggestionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        suggestions.push(match[1].trim());
      }
    });
    
    return suggestions;
  }

  calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
    // Claude pricing (as of 2024)
    const inputCostPer1K = 0.003;  // $0.003 per 1K input tokens
    const outputCostPer1K = 0.015; // $0.015 per 1K output tokens
    
    const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
    const outputCost = (usage.completionTokens / 1000) * outputCostPer1K;
    
    return inputCost + outputCost;
  }
}