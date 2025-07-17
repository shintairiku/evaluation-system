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
  error?: string;
  message?: string;
}
```

## Migration from Old Client

If you're using the old `http-client.ts`, no changes needed - it automatically imports from the unified client. However, for client-side usage, make sure to use the `useAuthSync()` hook.