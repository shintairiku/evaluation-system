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

export interface RequestInterceptor {
  onRequest?: (config: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
  }) => void | Promise<void>;
}

export interface ResponseInterceptor {
  onResponse?: (response: {
    url: string;
    method: string;
    status: number;
    statusText: string;
    headers: Headers;
    duration: number;
  }) => void | Promise<void>;
  
  onError?: (error: {
    url: string;
    method: string;
    error: unknown;
    duration: number;
    attempt: number;
    isRetry: boolean;
  }) => void | Promise<void>;
}

// Environment detection
const isServer = typeof window === 'undefined';

// Helper function to determine if an error is retryable
function isRetryableError(error: unknown, status?: number): boolean {
  // Network errors (no response received)
  if (error instanceof Error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true; // Network connectivity issues
    }
    if (error.name === 'AbortError') {
      return false; // Timeout errors should not be retried
    }
  }
  
  // HTTP status codes that should be retried
  if (status) {
    return (
      status >= 500 || // Server errors
      status === 429 || // Rate limiting
      status === 408    // Request timeout
    );
  }
  
  return false;
}

// Helper function to calculate exponential backoff delay
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff: baseDelay * 2^(attempt-1) with some jitter
  const delay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
  return Math.min(delay + jitter, API_CONFIG.MAX_RETRY_DELAY);
}

// Helper function to sleep/wait
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class UnifiedHttpClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.setupDefaultInterceptors();
  }

  // Add request interceptor
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  // Add response interceptor
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  // Remove request interceptor
  removeRequestInterceptor(interceptor: RequestInterceptor): boolean {
    const index = this.requestInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.requestInterceptors.splice(index, 1);
      return true;
    }
    return false;
  }

  // Remove response interceptor
  removeResponseInterceptor(interceptor: ResponseInterceptor): boolean {
    const index = this.responseInterceptors.indexOf(interceptor);
    if (index > -1) {
      this.responseInterceptors.splice(index, 1);
      return true;
    }
    return false;
  }

  // Setup default logging interceptors
  private setupDefaultInterceptors(): void {
    // Default request logging interceptor (respects ENABLE_REQUEST_LOGGING setting)
    if (API_CONFIG.ENABLE_REQUEST_LOGGING) {
      this.addRequestInterceptor({
        onRequest: (config) => {
          const hasAuth = config.headers.Authorization ? 'yes' : 'no';
          const bodyType = config.body instanceof FormData ? 'FormData' : 
                          typeof config.body === 'string' ? 'string' : 
                          config.body ? 'object' : 'none';
          
          console.log(`🚀 [${isServer ? 'Server' : 'Client'}] ${config.method} ${config.url}`, {
            auth: hasAuth,
            bodyType,
            headers: Object.keys(config.headers),
          });
        }
      });
    }

    // Default response logging interceptor
    this.addResponseInterceptor({
      onResponse: (response) => {
        if (API_CONFIG.ENABLE_REQUEST_LOGGING) {
          const statusEmoji = response.status >= 200 && response.status < 300 ? '✅' : 
                             response.status >= 400 && response.status < 500 ? '⚠️' : '❌';
          
          console.log(`${statusEmoji} [${isServer ? 'Server' : 'Client'}] ${response.method} ${response.url}`, {
            status: response.status,
            statusText: response.statusText,
            duration: `${response.duration}ms`,
          });
        }
      },
      onError: (error) => {
        // Always log errors if error logging is enabled
        if (API_CONFIG.ENABLE_ERROR_LOGGING) {
          const retryText = error.isRetry ? ` (retry ${error.attempt})` : '';
          console.error(`💥 [${isServer ? 'Server' : 'Client'}] ${error.method} ${error.url}${retryText}`, {
            error: error.error instanceof Error ? error.error.message : String(error.error),
            duration: `${error.duration}ms`,
            attempt: error.attempt,
          });
        }
      }
    });
  }

  // Helper to run request interceptors
  private async runRequestInterceptors(config: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
  }): Promise<void> {
    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onRequest) {
        await interceptor.onRequest(config);
      }
    }
  }

  // Helper to run response interceptors
  private async runResponseInterceptors(response: {
    url: string;
    method: string;
    status: number;
    statusText: string;
    headers: Headers;
    duration: number;
  }): Promise<void> {
    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onResponse) {
        await interceptor.onResponse(response);
      }
    }
  }

  // Helper to run error interceptors
  private async runErrorInterceptors(error: {
    url: string;
    method: string;
    error: unknown;
    duration: number;
    attempt: number;
    isRetry: boolean;
  }): Promise<void> {
    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onError) {
        await interceptor.onError(error);
      }
    }
  }

  // Get auth headers (with Clerk integration)
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

  private async makeHttpRequest(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<{ response?: Response; error?: unknown; isTimeout?: boolean; duration: number }> {
    const { method = 'GET', headers: customHeaders, body } = config;
    const startTime = Date.now();
    
    // Create AbortController for timeout functionality
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, API_CONFIG.TIMEOUT);
    
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers = await this.buildHeaders(customHeaders, body);
      
      // Run request interceptors
      await this.runRequestInterceptors({
        url,
        method,
        headers,
        body
      });
      
      const requestConfig: RequestInit = {
        method,
        headers,
        signal: abortController.signal,
      };

      if (body && method !== 'GET') {
        if (body instanceof FormData) {
          requestConfig.body = body;
        } else if (typeof body === 'string') {
          requestConfig.body = body;
        } else {
          requestConfig.body = JSON.stringify(body);
        }
      }

      const response = await fetch(url, requestConfig);
      const duration = Date.now() - startTime;
      
      // Run response interceptors
      await this.runResponseInterceptors({
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        duration
      });
      
      return { response, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return { error, isTimeout, duration };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request<T = unknown>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET' } = config;
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: unknown;
    let lastResponse: Response | undefined;
    let isTimeoutError = false;
    let totalDuration = 0;
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      const { response, error, isTimeout, duration } = await this.makeHttpRequest(endpoint, config);
      totalDuration += duration;
      
      if (response) {
        // If successful response or non-retryable error status, return immediately
        if (response.ok || !isRetryableError(undefined, response.status)) {
          const result = await this.handleResponse<T>(response);
          return result;
        }
        
        lastResponse = response;
      } else if (error) {
        lastError = error;
        isTimeoutError = isTimeout || false;
        
        // Run error interceptors
        await this.runErrorInterceptors({
          url,
          method,
          error,
          duration,
          attempt,
          isRetry: attempt > 1
        });
        
        // If not retryable, break early
        if (!isRetryableError(error)) {
          break;
        }
      }
      
      // If this is the last attempt, don't wait
      if (attempt === API_CONFIG.RETRY_ATTEMPTS) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      const delay = calculateBackoffDelay(attempt, API_CONFIG.RETRY_DELAY);
      await sleep(delay);
    }
    
    // All attempts failed, handle the final error
    if (lastResponse) {
      // Had a response but it was an error status
      const result = await this.handleResponse<T>(lastResponse);
      return result;
    } else {
      // Network/timeout error - run final error interceptor
      await this.runErrorInterceptors({
        url,
        method,
        error: lastError,
        duration: totalDuration,
        attempt: API_CONFIG.RETRY_ATTEMPTS,
        isRetry: true
      });
      
      if (isTimeoutError) {
        const appError = createAppError(
          new Error('Request timeout'),
          408,
          `Request timed out after ${API_CONFIG.TIMEOUT}ms: ${method} ${endpoint} (attempted ${API_CONFIG.RETRY_ATTEMPTS} times)`
        );
        logError(appError, `HTTP Client - Timeout Error after retries (${isServer ? 'Server' : 'Client'})`);
        
        return {
          success: false,
          errorMessage: appError.userMessage,
          error: appError.userMessage,
        };
      } else {
        const appError = createAppError(
          lastError,
          undefined,
          `Network request failed: ${method} ${endpoint} (attempted ${API_CONFIG.RETRY_ATTEMPTS} times) (${isServer ? 'Server' : 'Client'})`
        );
        logError(appError, `HTTP Client - Network Error after retries (${isServer ? 'Server' : 'Client'})`);
        
        return {
          success: false,
          errorMessage: appError.userMessage,
          error: appError.userMessage,
        };
      }
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