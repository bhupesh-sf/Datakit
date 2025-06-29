import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { WebLLMProvider } from "./providers/webllm";
import { 
  AIProvider, 
  AIMessage, 
  AIResponse, 
  AIStreamResponse,
  SQLGenerationRequest,
  SQLGenerationResponse,
  DataAnalysisRequest,
  DataAnalysisResponse,
  AIContextData
} from "../../types/ai";
import { 
  AIMessage as LibAIMessage, 
  AIResponse as LibAIResponse,
  SQLGenerationRequest as LibSQLRequest,
  SQLGenerationResponse as LibSQLResponse,
  DataAnalysisRequest as LibAnalysisRequest,
  DataAnalysisResponse as LibAnalysisResponse,
  AIContextData as LibContextData
} from "./types";

export class AIService {
  private providers: Map<AIProvider, any> = new Map();
  private webllmProvider: WebLLMProvider | null = null;

  constructor() {
    // Providers will be initialized when API keys are provided
    // Initialize WebLLM provider (doesn't need API key)
    this.webllmProvider = new WebLLMProvider();
    this.providers.set('local', this.webllmProvider);
  }

  setApiKey(provider: AIProvider, apiKey: string, model?: string): void {
    switch (provider) {
      case 'openai':
        this.providers.set(provider, new OpenAIProvider(apiKey, model));
        break;
      case 'anthropic':
        this.providers.set(provider, new AnthropicProvider(apiKey, model));
        break;
      case 'local':
        // Local provider already initialized in constructor
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async validateApiKey(provider: AIProvider): Promise<boolean> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    if (provider === 'local') {
      return true; // Local models don't need API key validation
    }

    return await providerInstance.validateApiKey();
  }

  async generateSQL(
    provider: AIProvider,
    prompt: string,
    context: AIContextData
  ): Promise<SQLGenerationResponse> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    const request: LibSQLRequest = {
      prompt,
      context: this.convertContext(context),
      includeExplanation: true,
      maxRows: 100,
    };

    const response = await providerInstance.generateSQL(request);
    return this.convertSQLResponse(response);
  }

  async analyzeData(
    provider: AIProvider,
    prompt: string,
    context: AIContextData,
    data?: any[]
  ): Promise<DataAnalysisResponse> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    const request: LibAnalysisRequest = {
      prompt,
      context: this.convertContext(context),
      data: data || [],
    };

    const response = await providerInstance.analyzeData(request);
    return this.convertAnalysisResponse(response);
  }

  async generateCompletionStream(
    provider: AIProvider,
    messages: AIMessage[],
    onChunk: (chunk: AIStreamResponse) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    const libMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    await providerInstance.generateStreamCompletion(libMessages, onChunk, options);
  }

  async generateCompletion(
    provider: AIProvider,
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    const libMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    return await providerInstance.generateCompletion(libMessages, options);
  }

  calculateCost(
    provider: AIProvider,
    usage: { promptTokens: number; completionTokens: number }
  ): number {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance || provider === 'local') {
      return 0;
    }

    return providerInstance.calculateCost(usage);
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  isProviderReady(provider: AIProvider): boolean {
    if (provider === 'local') {
      return this.webllmProvider?.isModelLoaded() || false;
    }
    return this.providers.has(provider);
  }

  // WebLLM-specific methods
  async loadLocalModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.webllmProvider) {
      throw new Error('WebLLM provider not initialized');
    }
    await this.webllmProvider.loadModel(modelId, onProgress);
  }

  async unloadLocalModel(): Promise<void> {
    if (this.webllmProvider) {
      await this.webllmProvider.unloadModel();
    }
  }

  getLoadedLocalModel(): string | null {
    return this.webllmProvider?.getCurrentModel() || null;
  }

  getAvailableLocalModels() {
    return this.webllmProvider?.getAvailableModels() || [];
  }

  async isWebGPUSupported(): Promise<boolean> {
    return this.webllmProvider?.isWebGPUSupported() || false;
  }

  getLocalModelInfo(modelId: string) {
    return this.webllmProvider?.getModelInfo(modelId);
  }

  estimateModelDownloadSize(modelId: string): number {
    return this.webllmProvider?.estimateDownloadSize(modelId) || 0;
  }

  isLocalModelLoaded(): boolean {
    return this.webllmProvider?.isModelLoaded() || false;
  }

  // Helper methods to convert between type systems
  private convertContext(context: AIContextData): LibContextData {
    return {
      tableName: context.tableName,
      schema: context.schema,
      sampleData: context.sampleData,
      rowCount: context.rowCount,
      description: context.description,
    };
  }

  private convertSQLResponse(response: LibSQLResponse): SQLGenerationResponse {
    return {
      sql: response.sql,
      explanation: response.explanation,
      confidence: response.confidence,
      warnings: response.warnings,
    };
  }

  private convertAnalysisResponse(response: LibAnalysisResponse): DataAnalysisResponse {
    return {
      analysis: response.analysis,
      insights: response.insights,
      suggestions: response.suggestions,
      visualization: response.visualization,
    };
  }
}

// Global AI service instance
export const aiService = new AIService();