import { logApiCall, logApiResponse } from './debugHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    // UPDATE 02/07/2025
    // No need for manual headers - cookies are sent automatically

    return {};
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        // Don't auto-logout - let the calling code handle 401 errors
        // This prevents infinite loops
        throw new Error('Unauthorized');
      }

      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Ignore JSON parse error
      }
      
      throw new Error(errorMessage);
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    return response.json();
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipAuth = false, headers = {}, ...restOptions } = options;
    
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();
    
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    const method = restOptions.method || 'GET';
    
    // Log API call in development
    logApiCall(method, url, restOptions.body ? JSON.parse(restOptions.body as string) : undefined);

    try {
      const response = await fetch(url, {
        ...restOptions,
        headers: finalHeaders,
        credentials: 'include', // Important: Include cookies in requests
      });

      const result = await this.handleResponse<T>(response);
      logApiResponse(url, result);
      return result;
    } catch (error) {
      logApiResponse(url, null, error);
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Streaming method for AI responses
  async stream(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<Response> {
    const { skipAuth = false, headers = {}, ...restOptions } = options || {};
    
    const authHeaders = skipAuth ? {} : await this.getAuthHeaders();
    
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    };

    const url = `${this.baseURL}${endpoint}`;
    
    // Log API call in development
    logApiCall('POST', url, data);

    try {
      const response = await fetch(url, {
        ...restOptions,
        method: 'POST',
        headers: finalHeaders,
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      logApiResponse(url, null, error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;