# HTTP Client Usage Guide

This directory contains the unified HTTP client that works in both server-side and client-side contexts with production-ready features including timeout handling, retry logic, and comprehensive logging.

## Key Features ✨

- 🔐 **Automatic Authentication**: Seamless Clerk token injection for both server and client contexts
- ⏱️ **Timeout Protection**: 30-second request timeout with proper error handling
- 🔄 **Intelligent Retry Logic**: Exponential backoff retry for transient failures (3 attempts)
- 📊 **Structured Logging**: Comprehensive request/response logging via interceptors
- 🚀 **Production Ready**: Environment-aware configuration and performance optimizations
- 🔧 **Extensible**: Custom interceptor system for monitoring and middleware
- 📁 **File Upload Support**: Built-in FormData handling for file uploads

## Files

- `http-unified-client.ts` - Main unified HTTP client with timeout, retry, and interceptors
- `http-client.ts` - Backward compatibility wrapper (deprecated)
- `auth-helper.ts` - Client-side auth token management
- `test-example.ts` - Usage examples and advanced features demo
- `README.md` - This documentation

## Usage

### Server-Side (Server Components, Server Actions, Route Handlers)

```typescript
import { getHttpClient } from '@/api/client/http-unified-client';

// Server components or server actions
export async function ServerComponent() {
  const httpClient = getHttpClient();
  const response = await httpClient.get('/api/users');
  
  if (response.success) {
    console.log('Users:', response.data);
  }
}
```

### Client-Side (Client Components)

```typescript
'use client';

import { getHttpClient } from '@/api/client/http-unified-client';
import { useAuthSync } from '@/api/hooks/useAuthSync';

export function ClientComponent() {
  // This hook ensures the HTTP client has the auth token
  useAuthSync();
  
  const handleApiCall = async () => {
    const httpClient = getHttpClient();
    const response = await httpClient.get('/api/users');
    
    if (response.success) {
      console.log('Users:', response.data);
    }
  };

  return (
    <button onClick={handleApiCall}>
      Load Users
    </button>
  );
}
```

### Root Layout Setup

Add the auth sync to your root layout or a high-level component:

```typescript
'use client';

import { useAuthSync } from '@/api/hooks/useAuthSync';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuthSync(); // Automatically syncs auth state
  
  return <>{children}</>;
}
```

## How It Works

1. **Environment Detection**: The client automatically detects if it's running server-side or client-side
2. **Server-Side Auth**: Uses `@clerk/nextjs/server` auth() function
3. **Client-Side Auth**: Uses a token management system that syncs with Clerk's client instance
4. **Error Handling**: All requests use the centralized error handling system
5. **Type Safety**: Full TypeScript support with proper generic types

## Error Handling

The client includes comprehensive error handling:

- Japanese user-friendly error messages
- Structured error logging
- Retry detection for network errors
- Contextual error information

## API Response Format

All API calls return a standardized response:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  errorMessage?: string;  // Preferred unified error message
  error?: string;         // Deprecated: use errorMessage
  message?: string;       // Deprecated: use errorMessage
}
```

**Note**: Use `response.errorMessage` for new code. The `error` and `message` properties are kept for backward compatibility.

## File Upload Support

The unified client includes built-in support for file uploads:

### Single File Upload

```typescript
const httpClient = getHttpClient();

// Upload a single file
const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const response = await httpClient.uploadFile(
    '/api/users/123/avatar',
    file,
    'avatar', // field name
    { userId: '123' } // additional form fields
  );
  
  if (response.success) {
    console.log('Upload successful:', response.data);
  } else {
    console.error('Upload failed:', response.errorMessage);
  }
}
```

### Multiple File Upload

```typescript
const files = Array.from(fileInput.files || []);

const response = await httpClient.uploadFiles(
  '/api/documents/upload',
  files,
  'documents',
  { category: 'reports' }
);
```

### Manual FormData Usage

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('metadata', JSON.stringify({ type: 'avatar' }));

const response = await httpClient.post('/api/upload', formData);
// Content-Type header automatically handled for FormData
```

## Advanced Features

### Timeout & Retry Configuration

The HTTP client automatically handles timeouts and retries:

```typescript
// Automatic timeout after 30 seconds
// Automatic retry with exponential backoff for:
// - Network errors
// - HTTP 5xx server errors  
// - HTTP 429 rate limiting
// - HTTP 408 request timeouts

const response = await httpClient.get('/api/users');
// Will retry up to 3 times with delays: ~1s, ~2s, ~4s
```

### Custom Interceptors

Add monitoring, logging, or custom behavior:

```typescript
import type { RequestInterceptor, ResponseInterceptor } from './http-unified-client';

// Performance monitoring interceptor
const performanceInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    console.log(`[Performance] Starting ${config.method} ${config.url}`);
  }
};

// Error monitoring interceptor
const errorInterceptor: ResponseInterceptor = {
  onResponse: (response) => {
    if (response.status >= 400) {
      // Send to monitoring service
      console.log(`[Monitor] Error ${response.status} in ${response.duration}ms`);
    }
  },
  onError: (error) => {
    // Track failed requests
    console.error(`[Monitor] Failed attempt ${error.attempt}:`, error.error);
  }
};

const httpClient = getHttpClient();
httpClient.addRequestInterceptor(performanceInterceptor);
httpClient.addResponseInterceptor(errorInterceptor);

// Remove when done
httpClient.removeRequestInterceptor(performanceInterceptor);
httpClient.removeResponseInterceptor(errorInterceptor);
```

### Environment-Aware Logging

Logging automatically adapts to environment:

**Development**:
- ✅ Full request/response logging with emojis
- ✅ Performance metrics
- ✅ Detailed error information

**Production**:
- ❌ Request/response logging disabled (performance)
- ✅ Error logging enabled (monitoring)
- ✅ Minimal overhead

### Retry Logic Details

The client intelligently retries only appropriate errors:

**Will Retry** ✅:
- Network connectivity issues
- HTTP 5xx server errors
- HTTP 429 rate limiting
- HTTP 408 request timeouts

**Won't Retry** ❌:
- HTTP 4xx client errors (bad request, unauthorized, etc.)
- Request timeouts (30s limit exceeded)
- Non-network errors

Retry timing follows exponential backoff:
- Attempt 1: ~1 second delay
- Attempt 2: ~2 seconds delay
- Attempt 3: ~4 seconds delay
- Maximum delay: 30 seconds

## Configuration

All settings are configurable via `../constants/config.ts`:

```typescript
export const API_CONFIG = {
  TIMEOUT: 30000,              // 30 second timeout
  RETRY_ATTEMPTS: 3,           // Maximum retry attempts
  RETRY_DELAY: 1000,           // Base delay (1 second)
  MAX_RETRY_DELAY: 30000,      // Maximum delay cap
  ENABLE_REQUEST_LOGGING: true, // Environment-aware
  ENABLE_ERROR_LOGGING: true,   // Always enabled
} as const;
```

## Migration from Old Client

If you're using the old `http-client.ts`, no changes needed - it automatically imports from the unified client. However, for client-side usage, make sure to use the `useAuthSync()` hook.

### New Features Available

When migrating, you now get these features automatically:
- ✅ 30-second timeout protection
- ✅ Automatic retry with exponential backoff
- ✅ Structured logging with interceptors
- ✅ Production-optimized performance
- ✅ Enhanced error handling

### Breaking Changes

None! The API is fully backward compatible.