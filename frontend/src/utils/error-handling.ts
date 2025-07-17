/**
 * Centralized error handling utility for consistent error management across the application
 */

import type { ApiResponse } from '../api/types';

// Error types for categorization
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  UNKNOWN = 'UNKNOWN',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Standardized error structure
export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: unknown;
  statusCode?: number;
  timestamp: string;
  userMessage: string;
  actionable: boolean;
  retryable: boolean;
}

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<number, string> = {
  400: 'リクエストに問題があります。入力内容を確認してください。',
  401: 'ログインが必要です。再度ログインしてください。',
  403: 'この操作を実行する権限がありません。',
  404: 'リクエストされたデータが見つかりません。',
  409: 'データの競合が発生しました。ページを更新してやり直してください。',
  422: '入力データに問題があります。フォームの内容を確認してください。',
  429: 'リクエストが多すぎます。しばらく待ってからやり直してください。',
  500: 'サーバーエラーが発生しました。しばらく待ってからやり直してください。',
  502: 'サーバーに接続できません。しばらく待ってからやり直してください。',
  503: 'サービスが一時的に利用できません。しばらく待ってからやり直してください。',
  504: 'リクエストがタイムアウトしました。しばらく待ってからやり直してください。',
};

// Network error messages
const NETWORK_ERROR_MESSAGES: Record<string, string> = {
  'Failed to fetch': 'ネットワークに接続できません。インターネット接続を確認してください。',
  'NetworkError': 'ネットワークエラーが発生しました。接続を確認してください。',
  'TypeError': 'ネットワークエラーが発生しました。しばらく待ってからやり直してください。',
};

/**
 * Categorizes an error based on status code and error details
 */
function categorizeError(statusCode?: number, error?: unknown): ErrorType {
  if (!statusCode) {
    if (error instanceof TypeError || (error as Error)?.message?.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    return ErrorType.UNKNOWN;
  }

  if (statusCode === 401) return ErrorType.AUTHENTICATION;
  if (statusCode === 403) return ErrorType.AUTHORIZATION;
  if (statusCode >= 400 && statusCode < 500) return ErrorType.CLIENT;
  if (statusCode >= 500) return ErrorType.SERVER;
  
  return ErrorType.UNKNOWN;
}

/**
 * Determines error severity based on type and status code
 */
function determineSeverity(type: ErrorType, statusCode?: number): ErrorSeverity {
  switch (type) {
    case ErrorType.AUTHENTICATION:
    case ErrorType.AUTHORIZATION:
      return ErrorSeverity.HIGH;
    case ErrorType.SERVER:
      return statusCode === 500 ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH;
    case ErrorType.NETWORK:
      return ErrorSeverity.MEDIUM;
    case ErrorType.VALIDATION:
    case ErrorType.CLIENT:
      return ErrorSeverity.LOW;
    default:
      return ErrorSeverity.MEDIUM;
  }
}

/**
 * Determines if an error is retryable
 */
function isRetryable(type: ErrorType, statusCode?: number): boolean {
  switch (type) {
    case ErrorType.NETWORK:
      return true;
    case ErrorType.SERVER:
      return statusCode === 502 || statusCode === 503 || statusCode === 504;
    case ErrorType.CLIENT:
      return statusCode === 429; // Too Many Requests
    default:
      return false;
  }
}

/**
 * Gets user-friendly error message
 */
function getUserMessage(
  type: ErrorType,
  statusCode?: number,
  originalMessage?: string
): string {
  // Check for specific status code messages
  if (statusCode && ERROR_MESSAGES[statusCode]) {
    return ERROR_MESSAGES[statusCode];
  }

  // Check for network errors
  if (type === ErrorType.NETWORK && originalMessage) {
    for (const [key, message] of Object.entries(NETWORK_ERROR_MESSAGES)) {
      if (originalMessage.includes(key)) {
        return message;
      }
    }
  }

  // Default messages by type
  switch (type) {
    case ErrorType.AUTHENTICATION:
      return 'ログインが必要です。再度ログインしてください。';
    case ErrorType.AUTHORIZATION:
      return 'この操作を実行する権限がありません。';
    case ErrorType.VALIDATION:
      return '入力内容に問題があります。フォームを確認してください。';
    case ErrorType.NETWORK:
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    case ErrorType.SERVER:
      return 'サーバーエラーが発生しました。しばらく待ってからやり直してください。';
    default:
      return '予期しないエラーが発生しました。しばらく待ってからやり直してください。';
  }
}

/**
 * Creates a standardized AppError from various error sources
 */
export function createAppError(
  error: unknown,
  statusCode?: number,
  _context?: string
): AppError {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const type = categorizeError(statusCode, error);
  const severity = determineSeverity(type, statusCode);
  const userMessage = getUserMessage(type, statusCode, originalMessage);
  const retryable = isRetryable(type, statusCode);

  return {
    type,
    severity,
    message: originalMessage,
    originalError: error,
    statusCode,
    timestamp: new Date().toISOString(),
    userMessage,
    actionable: retryable || type === ErrorType.VALIDATION,
    retryable,
  };
}

/**
 * Handles API response errors and creates standardized AppError
 */
export function handleApiError<T>(response: ApiResponse<T>, context?: string): AppError {
  const statusCode = response.data && typeof response.data === 'object' && 'status' in response.data 
    ? (response.data as { status: number }).status 
    : undefined;
  
  return createAppError(
    new Error(response.error || 'API error occurred'),
    statusCode,
    context
  );
}

/**
 * Logs errors with appropriate level based on severity
 */
export function logError(appError: AppError, context?: string): void {
  const logData = {
    ...appError,
    context,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server',
  };

  switch (appError.severity) {
    case ErrorSeverity.CRITICAL:
      console.error('🔴 CRITICAL ERROR:', logData);
      break;
    case ErrorSeverity.HIGH:
      console.error('🟠 HIGH SEVERITY ERROR:', logData);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('🟡 MEDIUM SEVERITY ERROR:', logData);
      break;
    case ErrorSeverity.LOW:
      console.info('🔵 LOW SEVERITY ERROR:', logData);
      break;
  }

  // In a real application, you might want to send errors to an external service
  // Example: sendToErrorReporting(logData);
}

/**
 * Utility function to handle async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string,
  onError?: (error: AppError) => void
): Promise<{ data?: T; error?: AppError }> {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    const appError = createAppError(error, undefined, context);
    logError(appError, context);
    
    if (onError) {
      onError(appError);
    }
    
    return { error: appError };
  }
}

/**
 * React hook for error handling (to be used in components)
 */
export function useErrorHandler() {
  const handleError = (error: unknown, context?: string) => {
    const appError = createAppError(error, undefined, context);
    logError(appError, context);
    return appError;
  };

  const handleApiResponse = <T>(response: ApiResponse<T>, context?: string): AppError => {
    const appError = handleApiError(response, context);
    logError(appError, context);
    return appError;
  };

  return {
    handleError,
    handleApiError: handleApiResponse,
  };
}

/**
 * Extracts error message for display to users
 */
export function getDisplayErrorMessage(error: AppError | unknown): string {
  if (error && typeof error === 'object' && 'userMessage' in error) {
    return (error as AppError).userMessage;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return '予期しないエラーが発生しました。';
}