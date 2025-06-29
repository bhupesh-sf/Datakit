export type AIProvider = 'openai' | 'anthropic' | 'local' | 'custom';
export type ModelType = 'chat' | 'completion' | 'embedding';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  type: ModelType;
  contextWindow: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
  capabilities: string[];
  requiresApiKey: boolean;
  isLocal?: boolean;
}

export interface LocalModel extends AIModel {
  size: number; // in MB
  quantization?: '4bit' | '8bit' | '16bit';
  downloadUrl?: string;
  isDownloaded?: boolean;
  downloadProgress?: number;
}

export interface AIQuery {
  id: string;
  prompt: string;
  model: string;
  provider: AIProvider;
  response?: string;
  generatedSQL?: string;
  error?: string;
  timestamp: Date;
  executionTime?: number;
  tokens?: {
    input: number;
    output: number;
  };
  cost?: number;
}

export interface QueryIntent {
  type: 'query' | 'visualization' | 'analysis' | 'transform' | 'explain';
  confidence: number;
  suggestedSQL?: string;
  parameters?: Record<string, any>;
  explanation?: string;
}

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  inputSchema?: any;
  category: 'data' | 'analysis' | 'visualization' | 'other';
}

export interface MCPConnection {
  id: string;
  name: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  lastConnected?: Date;
}

export interface APIKeyConfig {
  provider: AIProvider;
  key: string;
  isValid?: boolean;
  lastValidated?: Date;
}

export interface AIExecutionPlan {
  steps: AIExecutionStep[];
  estimatedCost?: number;
  estimatedTime?: number;
  preferredModel?: string;
}

export interface AIExecutionStep {
  id: string;
  type: 'prompt' | 'sql' | 'visualization' | 'analysis';
  description: string;
  model?: string;
  input?: any;
  output?: any;
  status?: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

export interface AIInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'trend' | 'summary';
  title: string;
  description: string;
  confidence: number;
  relatedSQL?: string;
  visualization?: any;
}