# HTTP Client

This directory contains the HTTP client configuration for API communication.

## Files

### `http-client.ts`
A wrapper around the Fetch API with the following features:

- **Authentication**: Automatic Clerk token injection
- **Error Handling**: Consistent error response formatting
- **Type Safety**: Full TypeScript support with generics
- **Base URL Management**: Environment-based API base URL configuration
- **Request/Response Intercepting**: Built-in request and response processing

## Usage

### Basic Usage
```typescript
import { getHttpClient } from '@/api/client/http-client';

const httpClient = getHttpClient();

// GET request
const response = await httpClient.get<UserResponse>('/users/123');

// POST request
const response = await httpClient.post<UserResponse>('/users', userData);
```

### Response Format
All HTTP client methods return a standardized `ApiResponse<T>`:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Example
```typescript
const response = await httpClient.get<User>('/users/123');

if (response.success && response.data) {
  console.log('User:', response.data);
} else {
  console.error('Error:', response.error);
}
```

## Configuration

The HTTP client automatically:
- Uses `NEXT_PUBLIC_API_BASE_URL` environment variable for base URL
- Adds Clerk authentication tokens to requests
- Sets appropriate Content-Type headers
- Handles JSON parsing and error responses

## Error Handling

The client provides consistent error handling:
- Network errors are caught and wrapped
- HTTP error status codes are handled
- Authentication failures are properly formatted
- Response parsing errors are managed