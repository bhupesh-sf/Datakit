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

export class GroqProvider {
  private apiKey: string;
  private model: string;
  private apiProvider: SafeAPIProvider;

  constructor(apiKey: string, model: string = 'llama-3.1-70b-versatile') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiProvider = new SafeAPIProvider('https://api.groq.com/openai/v1', {
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
      console.error('Groq API key validation failed:', error);
      return false;
    }
  }

  async generateCompletion(messages: AIMessage[]): Promise<AIResponse> {
    try {
      const response = await this.apiProvider.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: this.model,
      };
    } catch (error) {
      console.error('Groq completion generation failed:', error);
      throw handleCORSError(error);
    }
  }

  async generateStreamCompletion(
    messages: AIMessage[], 
    onChunk: (response: AIStreamResponse) => void,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<void> {
    try {
      const requestBody = {
        model: this.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options.temperature || 0.1,
        max_tokens: options.maxTokens || 2000,
        stream: true,
      };
      
      const response = await this.apiProvider.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} ${response.statusText}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Send final response
            onChunk({
              content: fullContent,
              done: true,
              usage: totalUsage,
            });
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              
              if (data === '[DONE]') {
                onChunk({
                  content: fullContent,
                  done: true,
                  usage: totalUsage,
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                
                if (choice?.delta?.content) {
                  fullContent += choice.delta.content;
                  onChunk({
                    content: fullContent,
                    done: false,
                  });
                }

                if (parsed.usage) {
                  totalUsage = {
                    promptTokens: parsed.usage.prompt_tokens || 0,
                    completionTokens: parsed.usage.completion_tokens || 0,
                    totalTokens: parsed.usage.total_tokens || 0,
                  };
                }
              } catch (parseError) {
                console.warn('Failed to parse Groq SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Groq stream generation failed:', error);
      throw handleCORSError(error);
    }
  }

  async generateSQL(request: SQLGenerationRequest): Promise<SQLGenerationResponse> {
    const systemPrompt = createSystemPrompt(request.context);
    const sqlPrompt = createSQLPrompt(request.prompt, request.context);
    
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sqlPrompt }
    ];

    try {
      const response = await this.generateCompletion(messages);
      
      // Extract SQL from response (this could be improved with better parsing)
      const sqlMatch = response.content.match(/```sql\n([\s\S]*?)\n```/);
      const sql = sqlMatch ? sqlMatch[1].trim() : response.content.trim();
      
      return {
        sql,
        explanation: response.content,
        confidence: 0.8, // Default confidence for Groq
        warnings: [],
        usage: response.usage,
      };
    } catch (error) {
      console.error('Groq SQL generation failed:', error);
      throw error;
    }
  }

  async analyzeData(request: DataAnalysisRequest): Promise<DataAnalysisResponse> {
    const systemPrompt = createSystemPrompt(request.context);
    const analysisPrompt = createDataAnalysisPrompt(request.prompt, request.context, request.data);
    
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: analysisPrompt }
    ];

    try {
      const response = await this.generateCompletion(messages);
      
      return {
        analysis: response.content,
        insights: [], // Could be extracted from response
        suggestions: [], // Could be extracted from response  
        confidence: 0.8,
        usage: response.usage,
      };
    } catch (error) {
      console.error('Groq data analysis failed:', error);
      throw error;
    }
  }

  calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
    // Groq is free tier, so return 0
    return 0;
  }
}