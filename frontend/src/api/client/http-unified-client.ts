/**
 * Unified HTTP Client for both Server-Side and Client-Side contexts
 * Automatically detects environment and uses appropriate Clerk auth method
 */

import { API_CONFIG } from '../constants/config';
import { createAppError, logError } from '../../utils/error-handling';
import { ClientAuth } from './auth-helper';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
}

// Environment detection
const isServer = typeof window === 'undefined';

class UnifiedHttpClient {
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
      if (isServer) {
        // Server-side: Use @clerk/nextjs/server
        const { auth } = await import('@clerk/nextjs/server');
        const { getToken } = await auth();
        const token = await getToken();
        
        if (token) {
          return {
            'Authorization': `Bearer ${token}`,
          };
        }
      } else {
        // Client-side: Use ClientAuth helper
        let token = ClientAuth.getToken();
        
        // If no token stored, try to initialize from Clerk
        if (!token) {
          token = await ClientAuth.initializeFromClerk();
        }
        
        if (token) {
          return {
            'Authorization': `Bearer ${token}`,
          };
        }
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
    let data: unknown;

    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      const appError = createAppError(
        parseError,
        response.status,
        'Response parsing failed'
      );
      logError(appError, 'HTTP Client - Response Parsing');
      
      return {
        success: false,
        error: appError.userMessage,
        data: undefined,
      };
    }

    if (!response.ok) {
      const errorMessage = (data as { message?: string; error?: string })?.message || 
                          (data as { message?: string; error?: string })?.error || 
                          `HTTP ${response.status}: ${response.statusText}`;
      
      const appError = createAppError(
        new Error(errorMessage),
        response.status,
        `API request failed: ${response.url}`
      );
      logError(appError, 'HTTP Client - API Error');
      
      return {
        success: false,
        error: appError.userMessage,
        data: data as T,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  }

  async request<T = unknown>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', headers: customHeaders, body } = config;
    
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`HTTP Client (${isServer ? 'Server' : 'Client'}): Making request to:`, url);
      
      const headers = await this.buildHeaders(customHeaders);
      console.log(`HTTP Client (${isServer ? 'Server' : 'Client'}): Headers built:`, headers);
      
      const requestConfig: RequestInit = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        requestConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, requestConfig);
      console.log(`HTTP Client (${isServer ? 'Server' : 'Client'}): Response status:`, response.status, response.statusText);
      
      const result = await this.handleResponse<T>(response);
      console.log(`HTTP Client (${isServer ? 'Server' : 'Client'}): Final result:`, result);
      
      return result;
    } catch (error) {
      const appError = createAppError(
        error,
        undefined,
        `Network request failed: ${method} ${endpoint} (${isServer ? 'Server' : 'Client'})`
      );
      logError(appError, `HTTP Client - Network Error (${isServer ? 'Server' : 'Client'})`);
      
      return {
        success: false,
        error: appError.userMessage,
      };
    }
  }

  async get<T = unknown>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T = unknown>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  async put<T = unknown>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  async delete<T = unknown>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  async patch<T = unknown>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }
}

let httpClientInstance: UnifiedHttpClient | null = null;

export function getHttpClient(): UnifiedHttpClient {
  if (!httpClientInstance) {
    httpClientInstance = new UnifiedHttpClient(API_CONFIG.FULL_URL);
  }
  return httpClientInstance;
}

export default UnifiedHttpClient;