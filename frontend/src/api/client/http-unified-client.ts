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
  errorMessage?: string;
  /** @deprecated Use errorMessage instead */
  error?: string;
  /** @deprecated Use errorMessage instead */
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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
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

  private async buildHeaders(
    customHeaders?: Record<string, string>,
    body?: unknown
  ): Promise<Record<string, string>> {
    const authHeaders = await this.getAuthHeaders();
    
    // Start with auth headers only
    const headers: Record<string, string> = {
      ...authHeaders,
      ...customHeaders,
    };
    
    // Only add Content-Type if not already specified and body is not FormData
    if (!headers['Content-Type'] && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Remove Content-Type for FormData to let browser set multipart boundary
    if (body instanceof FormData && headers['Content-Type'] === 'application/json') {
      delete headers['Content-Type'];
    }
    
    return headers;
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
        errorMessage: appError.userMessage,
        error: appError.userMessage, // Backward compatibility
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
        errorMessage: appError.userMessage,
        error: appError.userMessage, // Backward compatibility
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
      
      const headers = await this.buildHeaders(customHeaders, body);
      console.log(`HTTP Client (${isServer ? 'Server' : 'Client'}): Headers built:`, headers);
      
      const requestConfig: RequestInit = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        if (body instanceof FormData) {
          // FormData: send as-is, browser will set Content-Type with boundary
          requestConfig.body = body;
        } else if (typeof body === 'string') {
          // String: send as-is
          requestConfig.body = body;
        } else {
          // Object: JSON stringify
          requestConfig.body = JSON.stringify(body);
        }
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
        errorMessage: appError.userMessage,
        error: appError.userMessage, // Backward compatibility
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

  /**
   * Upload a file using FormData
   * Automatically handles Content-Type for multipart/form-data
   */
  async uploadFile<T = unknown>(
    endpoint: string, 
    file: File, 
    fieldName = 'file',
    additionalFields?: Record<string, string | Blob>,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    
    return this.request<T>(endpoint, { method: 'POST', body: formData, headers });
  }

  /**
   * Upload multiple files using FormData
   */
  async uploadFiles<T = unknown>(
    endpoint: string,
    files: File[],
    fieldName = 'files',
    additionalFields?: Record<string, string | Blob>,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append(`${fieldName}[${index}]`, file);
    });
    
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    
    return this.request<T>(endpoint, { method: 'POST', body: formData, headers });
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