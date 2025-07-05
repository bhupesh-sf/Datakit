import {
  AIMessage,
  AIResponse,
  AIStreamResponse,
  SQLGenerationRequest,
  SQLGenerationResponse,
  DataAnalysisRequest,
  DataAnalysisResponse,
} from "../types";
import {
  createSystemPrompt,
  createSQLPrompt,
  createDataAnalysisPrompt,
} from "../prompts/sqlPrompts";
import { apiClient } from "@/lib/api/apiClient";

export interface DataKitResponse extends AIResponse {
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

export interface DataKitStreamResponse extends AIStreamResponse {
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

export class DataKitProvider {
  private model: string;

  constructor(model: string = "datakit-smart") {
    this.model = model;
  }

  private getApiHeaders(): HeadersInit {
    return {};
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Check if user has remaining credits
      const data = await apiClient.get<{ creditsRemaining: number }>(
        "/credits/remaining",
        {
          headers: this.getApiHeaders(),
        }
      );

      return data.creditsRemaining > 0 || data.creditsRemaining === -1; // -1 means unlimited
    } catch (error) {
      console.error("DataKit API validation failed:", error);
      return false;
    }
  }

  async checkCredits(estimatedCredits: number): Promise<{
    hasCredits: boolean;
    estimatedCredits: number;
    creditsRemaining: number;
    canProceed: boolean;
  }> {
    try {
      return await apiClient.post(
        "/ai/chat/completions/check",
        {
          model: this.model,
          messages: [{ role: "user", content: "test" }], // Minimal message for estimation
          max_tokens: 100, // Default estimation
        },
        {
          headers: this.getApiHeaders(),
        }
      );
    } catch (error) {
      console.error("Credit check failed:", error);
      throw error;
    }
  }

  async generateCompletion(
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<DataKitResponse> {
    try {
      // Convert to OpenAI-compatible format for backend
      const requestBody = {
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: options?.maxTokens || 20000,
        temperature: options?.temperature || 0.1,
        stream: options?.stream || false,
      };

      const data = await apiClient.post<any>(
        "/ai/chat/completions",
        requestBody,
        {
          headers: this.getApiHeaders(),
        }
      );

      // DataKit backend returns OpenAI-compatible response with DataKit metadata
      return {
        content: data.choices?.[0]?.message?.content || "",
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
        model: data.model || this.model,
        finishReason: data.choices?.[0]?.finish_reason,
        _datakit: data._datakit, // DataKit-specific metadata
      };
    } catch (error) {
      console.error("DataKit completion error:", error);
      throw error;
    }
  }

  async generateStreamCompletion(
    messages: AIMessage[],
    onChunk: (chunk: DataKitStreamResponse) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    try {
      const requestBody = {
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: options?.maxTokens || 2000,
        temperature: options?.temperature || 0.1,
        stream: true,
      };

      const response = await apiClient.stream(
        "/ai/chat/completions",
        requestBody,
        {
          headers: this.getApiHeaders(),
        }
      );

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let content = "";
      let usage: { promptTokens: number; completionTokens: number } | undefined;
      let datakitMetadata: any;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            onChunk({
              content,
              done: true,
              usage,
              _datakit: datakitMetadata,
            });
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk
            .split("\n")
            .filter((line) => line.trim().startsWith("data: "));

          for (const line of lines) {
            const data = line.replace("data: ", "");

            if (data.trim() === "[DONE]") {
              onChunk({
                content,
                done: true,
                usage,
                _datakit: datakitMetadata,
              });
              return;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.choices?.[0]?.delta?.content) {
                content += parsed.choices[0].delta.content;
                onChunk({ content, done: false });
              } else if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                };
              } else if (parsed._datakit) {
                datakitMetadata = parsed._datakit;
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
      console.error("DataKit stream error:", error);
      throw error;
    }
  }

  async generateSQL(
    request: SQLGenerationRequest
  ): Promise<SQLGenerationResponse> {
    const systemPrompt = createSystemPrompt(request.context);
    const userPrompt = createSQLPrompt(request.prompt, request.context, {
      includeExplanation: request.includeExplanation,
      maxRows: request.maxRows,
    });

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.1,
    });

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

  async analyzeData(
    request: DataAnalysisRequest
  ): Promise<DataAnalysisResponse> {
    const userPrompt = createDataAnalysisPrompt(
      request.prompt,
      request.context,
      request.data
    );

    const messages: AIMessage[] = [
      {
        role: "system",
        content:
          "You are a data analyst expert. Provide clear, actionable insights with specific recommendations.",
      },
      { role: "user", content: userPrompt },
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.3,
    });

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
    const lines = content.split("\n");
    const sqlLines = lines.filter((line) =>
      /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE)/i.test(line.trim())
    );

    if (sqlLines.length > 0) {
      return sqlLines.join("\n").trim();
    }

    return content.trim();
  }

  private extractExplanation(content: string): string | undefined {
    // Look for explanation sections
    const explanationMatch = content.match(
      /explanation:?\s*(.*?)(?=\n\n|\n```|$)/is
    );
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }

    // If no explicit explanation section, return the non-SQL parts
    const nonSqlParts = content.replace(/```sql[\s\S]*?```/gi, "").trim();
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

    warningPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        warnings.push(match[1].trim());
      }
    });

    return warnings;
  }

  private extractInsights(content: string): Array<{
    type: "trend" | "pattern" | "anomaly" | "summary";
    title: string;
    description: string;
    confidence: number;
  }> {
    // This is a simplified extraction - in a real implementation,
    // you'd want more sophisticated parsing
    const insights = [];
    const sections = content.split("\n").filter((line) => line.trim());

    for (const section of sections) {
      if (section.includes("trend") || section.includes("pattern")) {
        insights.push({
          type: "trend" as const,
          title: "Data Trend",
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

    suggestionPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        suggestions.push(match[1].trim());
      }
    });

    return suggestions;
  }

  calculateCost(usage: {
    promptTokens: number;
    completionTokens: number;
  }): number {
    // DataKit pricing based on the model selected
    let inputCostPer1K: number;
    let outputCostPer1K: number;

    if (this.model === "datakit-smart") {
      // Claude 3.5 Sonnet pricing converted to credits
      inputCostPer1K = 0.3; // 0.3 credits per 1K input tokens
      outputCostPer1K = 1.5; // 1.5 credits per 1K output tokens
    } else if (this.model === "datakit-fast") {
      // Claude 3.5 Haiku pricing converted to credits
      inputCostPer1K = 0.08; // 0.08 credits per 1K input tokens
      outputCostPer1K = 0.4; // 0.4 credits per 1K output tokens
    } else {
      // Default to smart model pricing
      inputCostPer1K = 0.3;
      outputCostPer1K = 1.5;
    }

    const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
    const outputCost = (usage.completionTokens / 1000) * outputCostPer1K;

    return inputCost + outputCost;
  }

  // Get remaining credits for the current user
  async getRemainingCredits(): Promise<number> {
    try {
      const data = await apiClient.get<{ creditsRemaining: number }>(
        "/credits/remaining",
        {
          headers: this.getApiHeaders(),
        }
      );

      return data.creditsRemaining;
    } catch (error) {
      console.error("Failed to get remaining credits:", error);
      throw error;
    }
  }

  // Get credit usage statistics
  async getCreditStats(): Promise<any> {
    try {
      return await apiClient.get("/credits/stats", {
        headers: this.getApiHeaders(),
      });
    } catch (error) {
      console.error("Failed to get credit stats:", error);
      throw error;
    }
  }
}
