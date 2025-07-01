export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface AIStreamResponse {
  content: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIContextData {
  tableName: string;
  schema: Array<{ name: string; type: string }>;
  sampleData?: any[];
  rowCount?: number;
  description?: string;
}

export interface SQLGenerationRequest {
  prompt: string;
  context: AIContextData;
  includeExplanation?: boolean;
  maxRows?: number;
}

export interface SQLGenerationResponse {
  sql: string;
  explanation?: string;
  confidence: number;
  warnings?: string[];
}

export interface DataAnalysisRequest {
  prompt: string;
  data: any[];
  context: AIContextData;
}

export interface DataAnalysisResponse {
  analysis: string;
  insights: Array<{
    type: 'trend' | 'pattern' | 'anomaly' | 'summary';
    title: string;
    description: string;
    confidence: number;
  }>;
  suggestions?: string[];
  visualization?: {
    type: string;
    config: any;
  };
}

export interface AIProviderConfig {
  name: string;
  baseUrl: string;
  defaultModel: string;
  maxTokens: number;
  supportedFeatures: string[];
}