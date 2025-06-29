// Safe API Provider that handles CORS and provides fallbacks
import { corsProxy } from '../corsProxy';

export interface SafeRequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  fallbackToLocal?: boolean;
}

export class SafeAPIProvider {
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    // Use Vite proxy in development mode to avoid CORS
    if (import.meta.env.DEV) {
      if (baseUrl.includes('api.openai.com')) {
        this.baseUrl = '/api/openai';
      } else if (baseUrl.includes('api.anthropic.com')) {
        this.baseUrl = '/api/anthropic';
      } else {
        this.baseUrl = baseUrl;
      }
    } else {
      this.baseUrl = baseUrl;
    }
    this.headers = defaultHeaders;
  }

  async makeRequest(endpoint: string, options: SafeRequestOptions = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const {
      timeout = 30000,
      retries = 2,
      fallbackToLocal = true,
      ...fetchOptions
    } = options;

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers: {
        ...this.headers,
        ...fetchOptions.headers,
      },
    };

    // Try direct request first (works in Electron, extensions, etc.)
    try {
      const response = await this.fetchWithTimeout(url, requestOptions, timeout);
      return response;
    } catch (error) {
      console.warn('Direct API request failed:', error);
      
      // If it's a CORS error, try proxy
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return this.tryProxyRequest(url, requestOptions, retries);
      }
      
      throw error;
    }
  }

  private async tryProxyRequest(url: string, options: RequestInit, retries: number): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Check if proxy is available
        const isProxyAvailable = await corsProxy.isAvailable();
        
        if (!isProxyAvailable) {
          throw new Error('CORS_PROXY_UNAVAILABLE');
        }

        return await corsProxy.makeRequest(url, options);
      } catch (error) {
        console.warn(`Proxy attempt ${attempt + 1} failed:`, error);
        
        if (attempt === retries) {
          // All attempts failed
          throw new Error('CORS_BLOCKED');
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Enhanced error handling for CORS issues
export class CORSError extends Error {
  public readonly instructions: string;
  public readonly canFallbackToLocal: boolean;

  constructor(message: string, instructions: string, canFallbackToLocal: boolean = true) {
    super(message);
    this.name = 'CORSError';
    this.instructions = instructions;
    this.canFallbackToLocal = canFallbackToLocal;
  }
}

export function handleCORSError(error: Error): CORSError {
  if (error.message === 'CORS_BLOCKED' || error.message.includes('CORS')) {
    return new CORSError(
      'API access blocked by browser security policy',
      corsProxy.getSetupInstructions(),
      true
    );
  }
  
  if (error.message === 'CORS_PROXY_UNAVAILABLE') {
    return new CORSError(
      'Proxy server not available',
      corsProxy.getSetupInstructions(),
      true
    );
  }
  
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return new CORSError(
      'Network request failed - likely CORS issue',
      corsProxy.getSetupInstructions(),
      true
    );
  }
  
  throw error; // Re-throw if not a CORS error
}