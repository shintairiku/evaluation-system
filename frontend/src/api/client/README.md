# HTTP Client Usage Guide

This directory contains the unified HTTP client that works in both server-side and client-side contexts.

## Files

- `http-unified-client.ts` - Main unified HTTP client
- `http-client.ts` - Backward compatibility wrapper (deprecated)
- `auth-helper.ts` - Client-side auth token management
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

## Migration from Old Client

If you're using the old `http-client.ts`, no changes needed - it automatically imports from the unified client. However, for client-side usage, make sure to use the `useAuthSync()` hook.