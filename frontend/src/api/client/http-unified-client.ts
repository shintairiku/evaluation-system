/**
 * Unified HTTP Client for both Server-Side and Client-Side contexts
 * Automatically detects environment and uses appropriate Clerk auth method
 */

import { API_CONFIG, buildOrgApiUrl } from '../constants/config';
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
  private orgSlug: string | null = null;
  private orgSlugPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.setupDefaultInterceptors();
  }

  /**
   * Get organization slug from JWT token
   * Caches the result to avoid repeated JWT parsing
   */
  private async getOrgSlug(): Promise<string | null> {
    // Return cached value if available
    if (this.orgSlug !== null) {
      return this.orgSlug;
    }

    // Return cached promise if already in progress
    if (this.orgSlugPromise) {
      return this.orgSlugPromise;
    }

    // Start new request
    this.orgSlugPromise = this.fetchOrgSlug();

    try {
      const slug = await this.orgSlugPromise;
      this.orgSlug = slug; // Cache the result
      return slug;
    } finally {
      this.orgSlugPromise = null; // Clear the promise
    }
  }

  /**
   * Fetch organization slug from JWT token
   */
  private async fetchOrgSlug(): Promise<string | null> {
    try {
      if (isServer) {
        // Server-side: Use getCurrentOrgSlug from jwt-parser
        const { getCurrentOrgSlug } = await import('../utils/jwt-parser');
        return await getCurrentOrgSlug();
      } else {
        // Client-side: Use ClientAuth helper
        let token = ClientAuth.getToken();

        if (!token) {
          token = await ClientAuth.initializeFromClerk('org-jwt');
        }

        if (token) {
          const { getOrgSlugFromToken } = await import('../utils/jwt-parser');
          return getOrgSlugFromToken(token);
        }
      }
    } catch (error) {
      console.warn('Failed to get organization slug:', error);
    }

    return null;
  }

  /**
   * Clear cached organization slug (useful when user changes org)
   */
  public clearOrgSlugCache(): void {
    this.orgSlug = null;
    this.orgSlugPromise = null;
  }

  /**
   * Set organization slug manually (for testing or special cases)
   */
  public setOrgSlug(slug: string | null): void {
    this.orgSlug = slug;
    this.orgSlugPromise = null;
  }

  /**
   * Check if an endpoint should be organization-scoped
   * Auth endpoints are organization-agnostic, all others should be org-scoped
   */
  private shouldApplyOrgScoping(endpoint: string): boolean {
    // Define comprehensive patterns that should NOT be organization-scoped
    // These patterns are designed to be robust against API version changes
    const nonOrgScopedPatterns = [
      // Auth endpoints (organization-agnostic)
      '/auth/',
      '/api/v1/auth/',
      '/api/v2/auth/', // Future API versions
      '/api/auth/',    // Any API version

      // Already org-scoped endpoints (should not double-scope)
      '/api/org/',
      '/org/',

      // Other global endpoints that might be added in the future
      // Add patterns here as needed
    ];

    // Check if endpoint matches any non-org-scoped pattern
    for (const pattern of nonOrgScopedPatterns) {
      if (endpoint.includes(pattern)) {
        return false;
      }
    }

    // All other endpoints should be organization-scoped
    return true;
  }

  /**
   * Public method to test organization scoping logic
   * This is for testing purposes only
   */
  public testShouldApplyOrgScoping(endpoint: string): boolean {
    return this.shouldApplyOrgScoping(endpoint);
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
        const token = await getToken({ template: 'org-jwt' });
        
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
          token = await ClientAuth.initializeFromClerk('org-jwt');
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
      // Prefer FastAPI's {detail: string} or legacy {message|error}
      const errorMessage = (data as { detail?: string; message?: string; error?: string })?.detail ||
                          (data as { message?: string; error?: string })?.message || 
                          (data as { message?: string; error?: string })?.error || 
                          `HTTP ${response.status}: ${response.statusText}`;
      
      // Handle 403 Forbidden as expected authorization error (not a system error)
      if (response.status === 403) {
        // Role-based access control rejection - this is normal business logic
        return {
          success: false,
          errorMessage: 'Access denied: Insufficient permissions',
          error: 'Access denied: Insufficient permissions', // Backward compatibility
          data: data as T,
        };
      }
      
      // For other errors, log as system errors
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
      // Get organization slug
      const orgSlug = await this.getOrgSlug();

      // Construct URL based on organization context
      let url: string;
      const shouldScope = this.shouldApplyOrgScoping(endpoint);

      if (shouldScope && orgSlug) {
        // Use organization-scoped URL for business logic endpoints
        const orgScopedEndpoint = buildOrgApiUrl(orgSlug, endpoint);
        url = `${this.baseUrl}${orgScopedEndpoint}`;
      } else {
        // Use regular URL for auth endpoints or when org context is not available
        url = `${this.baseUrl}${endpoint}`;
      }

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
    httpClientInstance = new UnifiedHttpClient(API_CONFIG.BASE_URL);
  }
  return httpClientInstance;
}

export default UnifiedHttpClient;

/**
 * Test the organization scoping functionality
 * This is a temporary test function to verify the implementation works
 */
/**
 * Test the organization scoping functionality
 * This function tests various endpoint patterns to ensure correct scoping behavior
 */
export async function testOrgScoping() {
  const client = getHttpClient();

  console.log('=== Organization Scoping Test ===');

  // Test cases: [endpoint, expected_result, description]
  const testCases: [string, boolean, string][] = [
    // Auth endpoints (should NOT be org-scoped)
    ['/api/v1/auth/user/123', false, 'API v1 auth endpoint'],
    ['/api/v2/auth/user/456', false, 'API v2 auth endpoint (future-proofing)'],
    ['/auth/signup/profile-options', false, 'Auth endpoint without API version'],
    ['/api/auth/dev-keys', false, 'Generic API auth endpoint'],

    // Business endpoints (should be org-scoped)
    ['/api/v1/users', true, 'API v1 users endpoint'],
    ['/api/v1/goals', true, 'API v1 goals endpoint'],
    ['/users', true, 'Users endpoint without API version'],

    // Already org-scoped endpoints (should NOT double-scope)
    ['/api/org/acme-corp/users', false, 'Already org-scoped users endpoint'],
    ['/org/acme-corp/goals', false, 'Org-scoped goals endpoint without API version'],
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const [endpoint, expected, description] of testCases) {
    const result = client.testShouldApplyOrgScoping(endpoint);
    const passed = result === expected;

    console.log(`${passed ? '✅' : '❌'} ${description}`);
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Expected: ${expected}, Got: ${result ? 'true' : 'false'}`);

    if (passed) {
      passedTests++;
    } else {
      console.log(`   ❌ TEST FAILED!`);
    }

    console.log('');
  }

  console.log(`=== Test Results: ${passedTests}/${totalTests} passed ===`);
}