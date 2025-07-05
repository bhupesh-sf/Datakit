import apiClient from "./apiClient";

class AIService {
  async getAvailableModels(): Promise<{
    datakit: Array<{ id: string; name: string; description: string }>;
    openai: string[];
    anthropic: string[];
  }> {
    return apiClient.get("/ai/models");
  }

  async validateApiKey(
    provider: "openai" | "anthropic",
    apiKey: string
  ): Promise<{
    valid: boolean;
    message?: string;
  }> {
    return apiClient.post("/ai/validate-key", { provider, apiKey });
  }
}

export const aiService = new AIService();
export default aiService;
