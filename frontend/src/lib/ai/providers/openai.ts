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

export class OpenAIProvider {
  private apiKey: string;
  private model: string;
  private apiProvider: SafeAPIProvider;

  constructor(apiKey: string, model: string = 'gpt-4-turbo-preview') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiProvider = new SafeAPIProvider('https://api.openai.com/v1', {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    });
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.apiProvider.makeRequest('/models', {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error);
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
      const response = await this.apiProvider.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature || 0.1,
          max_tokens: options?.maxTokens || 2000,
          stream: options?.stream || false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
    
      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        model: data.model,
        finishReason: data.choices[0]?.finish_reason,
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
      const response = await this.apiProvider.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature || 0.1,
          max_tokens: options?.maxTokens || 2000,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
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
          
          if (data === '[DONE]') {
            onChunk({ content, done: true });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            
            if (delta) {
              content += delta;
              onChunk({ content, done: false });
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
    // GPT-4 pricing (as of 2024)
    const inputCostPer1K = 0.03;  // $0.03 per 1K input tokens
    const outputCostPer1K = 0.06; // $0.06 per 1K output tokens
    
    const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
    const outputCost = (usage.completionTokens / 1000) * outputCostPer1K;
    
    return inputCost + outputCost;
  }
}