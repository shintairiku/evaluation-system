import { auth } from '@clerk/nextjs/server';
import { API_CONFIG } from '../constants/config';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
}

class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const { getToken } = await auth();
      const token = await getToken();
      
      if (token) {
        return {
          'Authorization': `Bearer ${token}`,
        };
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
    
    return {};
  }

  private async buildHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>> {
    const authHeaders = await this.getAuthHeaders();
    
    return {
      ...this.defaultHeaders,
      ...authHeaders,
      ...customHeaders,
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`,
        data: data,
      };
    }

    return {
      success: true,
      data: data,
    };
  }

  async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', headers: customHeaders, body } = config;
    
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log('HTTP Client: Making request to:', url);
      console.log('HTTP Client: Base URL:', this.baseUrl);
      console.log('HTTP Client: Endpoint:', endpoint);
      
      const headers = await this.buildHeaders(customHeaders);
      console.log('HTTP Client: Headers built:', headers);
      
      const requestConfig: RequestInit = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        requestConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      console.log('HTTP Client: About to fetch with config:', { url, method, headers: requestConfig.headers });
      const response = await fetch(url, requestConfig);
      console.log('HTTP Client: Fetch response status:', response.status, response.statusText);
      
      const result = await this.handleResponse<T>(response);
      console.log('HTTP Client: Final result:', result);
      
      return result;
    } catch (error) {
      console.error('HTTP Client: Fetch error:', error);
      console.error('HTTP Client: Error type:', typeof error);
      console.error('HTTP Client: Error message:', error instanceof Error ? error.message : String(error));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  async put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  async delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  async patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }
}

let httpClientInstance: HttpClient | null = null;

export function getHttpClient(): HttpClient {
  if (!httpClientInstance) {
    httpClientInstance = new HttpClient(API_CONFIG.FULL_URL);
  }
  return httpClientInstance;
}

export default HttpClient;