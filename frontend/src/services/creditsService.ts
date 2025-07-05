import { apiClient } from "@/lib/api/apiClient";

export interface CreditUsage {
  id: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  prompt?: string;
  response?: string;
  createdAt: string;
}

export interface CreditStats {
  totalCreditsUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  usageByModel: Record<string, number>;
  usageByProvider: Record<string, number>;
}

export interface CreditEstimate {
  estimatedCredits: number;
}

export interface CreditCheck {
  hasCredits: boolean;
  estimatedCredits: number;
  creditsRemaining: number;
  canProceed: boolean;
}

class CreditsService {
  async getRemainingCredits(): Promise<{ creditsRemaining: number }> {
    const response = await apiClient.get("/credits/remaining");
    return response;
  }

  async estimateCredits(
    modelId: string,
    inputTokens: number,
    outputTokens?: number
  ): Promise<CreditEstimate> {
    const response = await apiClient.post("/credits/estimate", {
      modelId,
      inputTokens,
      outputTokens,
    });
    return response;
  }

  async checkCredits(
    estimatedCredits: number
  ): Promise<{ hasCredits: boolean }> {
    const response = await apiClient.post("/credits/check", {
      estimatedCredits,
    });
    return response;
  }

  async getUsageHistory(
    limit = 50,
    offset = 0
  ): Promise<{
    usages: CreditUsage[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const response = await apiClient.get(
      `/credits/usage?limit=${limit}&offset=${offset}`
    );
    return response;
  }

  async getUsageStats(): Promise<CreditStats> {
    const response = await apiClient.get("/credits/stats");
    return response;
  }

  async checkAIRequest(model: string, messages: any[]): Promise<CreditCheck> {
    const response = await apiClient.post(
      "/ai/chat/completions/check",
      {
        model,
        messages,
      },
      {
        headers: {},
      }
    );
    return response;
  }
}

export const creditsService = new CreditsService();
