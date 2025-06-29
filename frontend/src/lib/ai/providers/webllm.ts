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

// WebLLM types (these will be available when the package is installed)
interface WebLLMEngine {
  reload(modelId: string, chatOpts?: any): Promise<void>;
  chat: {
    completions: {
      create(request: any): Promise<any>;
    };
  };
  unload(): Promise<void>;
  isLoaded(): boolean;
  getLoadedModelId(): string | null;
}

interface WebLLMEngineWorkerHandler {
  chat: {
    completions: {
      create(request: any, requestId?: string): Promise<any>;
    };
  };
  reload(modelId: string, chatOpts?: any): Promise<void>;
  unload(): Promise<void>;
  isLoaded(): boolean;
  getLoadedModelId(): string | null;
}

export class WebLLMProvider {
  private engine: WebLLMEngine | WebLLMEngineWorkerHandler | null = null;
  private currentModel: string | null = null;
  private isInitializing: boolean = false;
  private useWorker: boolean = true;

  // Available WebLLM models optimized for SQL/data analysis
  private readonly SUPPORTED_MODELS = [
    {
      id: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      name: "Llama 3.2 3B Instruct",
      size: 1800, // MB
      description: "Fast and efficient for SQL generation",
      capabilities: ["sql", "analysis", "reasoning"],
    },
    {
      id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
      name: "Phi 3.5 Mini Instruct", 
      size: 2300, // MB
      description: "Microsoft's efficient model for code and reasoning",
      capabilities: ["sql", "code", "analysis"],
    },
    {
      id: "gemma-2-2b-it-q4f16_1-MLC",
      name: "Gemma 2 2B Instruct",
      size: 1400, // MB
      description: "Google's lightweight model for text tasks",
      capabilities: ["sql", "basic"],
    },
  ];

  constructor(useWorker: boolean = true) {
    this.useWorker = useWorker;
  }

  async validateApiKey(): Promise<boolean> {
    // Local models don't need API key validation
    return true;
  }

  async isWebGPUSupported(): Promise<boolean> {
    if (!navigator.gpu) {
      return false;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch (error) {
      console.warn('WebGPU not supported:', error);
      return false;
    }
  }

  async initializeEngine(): Promise<void> {
    if (this.engine || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      // Check WebGPU support
      const webGPUSupported = await this.isWebGPUSupported();
      if (!webGPUSupported) {
        throw new Error('WebGPU is not supported in this browser. Please use Chrome/Edge 113+ or Firefox 110+');
      }

      // Dynamic import WebLLM (will be installed as dependency)
      let WebLLM: any;
      try {
        WebLLM = await import('@mlc-ai/web-llm');
      } catch (error) {
        throw new Error('WebLLM package not found. Please install @mlc-ai/web-llm');
      }

      if (this.useWorker) {
        // Use worker for better performance
        this.engine = new WebLLM.EngineWorkerHandler();
      } else {
        // Use main thread (fallback)
        this.engine = new WebLLM.MLCEngine();
      }

      console.log('WebLLM engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async loadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.engine) {
      await this.initializeEngine();
    }

    if (!this.engine) {
      throw new Error('Failed to initialize WebLLM engine');
    }

    try {
      console.log(`Loading model: ${modelId}`);
      
      // WebLLM supports progress callbacks through init progress
      const chatOpts = onProgress ? {
        initProgressCallback: (report: any) => {
          if (report.progress !== undefined) {
            onProgress(report.progress * 100);
          }
        }
      } : undefined;

      await this.engine.reload(modelId, chatOpts);
      this.currentModel = modelId;
      
      console.log(`Model ${modelId} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  async unloadModel(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.currentModel = null;
    }
  }

  isModelLoaded(): boolean {
    return this.engine?.isLoaded() || false;
  }

  getCurrentModel(): string | null {
    return this.engine?.getLoadedModelId() || null;
  }

  getAvailableModels() {
    return this.SUPPORTED_MODELS;
  }

  async generateCompletion(
    messages: AIMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<AIResponse> {
    if (!this.engine || !this.isModelLoaded()) {
      throw new Error('No model is currently loaded');
    }

    const webllmMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const response = await this.engine.chat.completions.create({
        messages: webllmMessages,
        temperature: options?.temperature || 0.1,
        max_tokens: options?.maxTokens || 2000,
        stream: false,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          totalTokens: response.usage.total_tokens || 0,
        } : undefined,
        model: this.currentModel || 'unknown',
        finishReason: response.choices[0]?.finish_reason,
      };
    } catch (error) {
      console.error('WebLLM completion error:', error);
      throw new Error(`WebLLM completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    if (!this.engine || !this.isModelLoaded()) {
      throw new Error('No model is currently loaded');
    }

    const webllmMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const completion = await this.engine.chat.completions.create({
        messages: webllmMessages,
        temperature: options?.temperature || 0.1,
        max_tokens: options?.maxTokens || 2000,
        stream: true,
      });

      let content = '';
      
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
          onChunk({ content, done: false });
        }
        
        if (chunk.choices[0]?.finish_reason) {
          onChunk({ 
            content, 
            done: true,
            usage: chunk.usage ? {
              promptTokens: chunk.usage.prompt_tokens || 0,
              completionTokens: chunk.usage.completion_tokens || 0,
              totalTokens: chunk.usage.total_tokens || 0,
            } : undefined
          });
          break;
        }
      }
    } catch (error) {
      console.error('WebLLM streaming error:', error);
      throw new Error(`WebLLM streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      confidence: 0.85, // Slightly lower confidence for local models
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

  // Helper methods (similar to OpenAI provider)
  private extractSQL(content: string): string {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/i);
    if (sqlMatch) {
      return sqlMatch[1].trim();
    }
    
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
    const explanationMatch = content.match(/explanation:?\s*(.*?)(?=\n\n|\n```|$)/is);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    
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

  calculateCost(): number {
    // Local models are free!
    return 0;
  }

  getModelInfo(modelId: string) {
    return this.SUPPORTED_MODELS.find(model => model.id === modelId);
  }

  estimateDownloadSize(modelId: string): number {
    const model = this.getModelInfo(modelId);
    return model?.size || 0;
  }
}