# API Constants

This directory contains configuration constants and endpoint definitions for the API client with production-ready timeout, retry, and logging settings.

## Files

### `config.ts`
Central configuration for all API-related constants including:

- **API_CONFIG**: Base configuration with production-ready settings
  - URLs and API versioning
  - Timeout configuration (30s)
  - Retry logic settings (3 attempts, exponential backoff)
  - Environment-aware logging controls
  - Performance optimization flags
- **API_ENDPOINTS**: All backend endpoint paths organized by resource
- **HTTP_STATUS**: HTTP status code constants
- **ERROR_MESSAGES**: Standardized error messages

## Usage

### API Endpoints
```typescript
import { API_ENDPOINTS } from '@/api/constants/config';

// Use endpoint constants
const userEndpoint = API_ENDPOINTS.USERS.BY_ID('user-123');
// Results in: '/users/user-123'

const listEndpoint = API_ENDPOINTS.USERS.LIST;
// Results in: '/users'
```

### Configuration
```typescript
import { API_CONFIG } from '@/api/constants/config';

// Access basic configuration
console.log(API_CONFIG.BASE_URL);   // http://backend:8000
console.log(API_CONFIG.FULL_URL);   // http://backend:8000/api/v1
console.log(API_CONFIG.TIMEOUT);    // 30000 (30 seconds)

// Access retry configuration  
console.log(API_CONFIG.RETRY_ATTEMPTS);    // 3
console.log(API_CONFIG.RETRY_DELAY);       // 1000 (1 second base)
console.log(API_CONFIG.MAX_RETRY_DELAY);   // 30000 (30 second cap)

// Environment detection
console.log(API_CONFIG.IS_PRODUCTION);     // false in dev
console.log(API_CONFIG.IS_DEVELOPMENT);    // true in dev

// Logging configuration
console.log(API_CONFIG.ENABLE_REQUEST_LOGGING); // false in production
console.log(API_CONFIG.ENABLE_ERROR_LOGGING);   // always true
```

### HTTP Status Codes
```typescript
import { HTTP_STATUS } from '@/api/constants/config';

if (response.status === HTTP_STATUS.UNAUTHORIZED) {
  // Handle unauthorized
}
```

### Error Messages
```typescript
import { ERROR_MESSAGES } from '@/api/constants/config';

return {
  success: false,
  error: ERROR_MESSAGES.UNAUTHORIZED
};
```

## Endpoint Organization

All endpoints are comprehensively organized by resource type with complete CRUD coverage:

### Core Resources
- **`AUTH`**: Authentication and session management endpoints
- **`USERS`**: User management endpoints (CRUD + profile operations)
- **`DEPARTMENTS`**: Department hierarchy endpoints (CRUD)
- **`ROLES`**: Role management endpoints (CRUD + reorder operations)
- **`STAGES`**: User stage/level endpoints (CRUD + admin operations)

### Evaluation System
- **`EVALUATION_PERIODS`**: Evaluation period lifecycle endpoints (CRUD + current period)
- **`GOALS`**: Goal management endpoints (CRUD + approval workflows)
- **`GOAL_CATEGORIES`**: Goal categorization endpoints (CRUD)
- **`COMPETENCIES`**: Competency framework endpoints (CRUD)
- **`SELF_ASSESSMENTS`**: Employee self-evaluation endpoints (CRUD + workflow operations)
- **`SUPERVISOR_REVIEWS`**: Manager review endpoints (CRUD + workflow operations)
- **`SUPERVISOR_FEEDBACKS`**: Feedback collection endpoints (CRUD + status management)

### Standard Endpoint Pattern

Each resource group follows a consistent pattern:

```typescript
RESOURCE: {
  LIST: '/resource',                           // GET - List with pagination
  BY_ID: (id: string) => `/resource/${id}`,    // GET - Individual item
  CREATE: '/resource',                         // POST - Create new
  UPDATE: (id: string) => `/resource/${id}`,   // PUT - Update existing  
  DELETE: (id: string) => `/resource/${id}`,   // DELETE - Remove item
  
  // Additional resource-specific endpoints
  SPECIAL_OPERATION: '/resource/special',      // Resource-specific operations
}

## Dynamic Endpoints

Many endpoints accept parameters:

```typescript
// Static endpoint
API_ENDPOINTS.USERS.LIST // '/users'

// Dynamic endpoint with ID
API_ENDPOINTS.USERS.BY_ID('123') // '/users/123'

// Dynamic endpoint with multiple params
API_ENDPOINTS.GOALS.BY_USER('user-123') // '/goals/user/user-123'
```

## Environment Configuration

### Base URL Resolution

The API base URL is automatically determined:

```typescript
const getApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_API_BASE_URL is not set for production');
    }
    return 'http://backend:8000'; // Docker development default
  }
  return baseUrl;
};
```

### Environment Variables

**Development (.env.local)**:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NODE_ENV=development
```

**Production (.env.production)**:
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NODE_ENV=production
```

**Docker Development**:
```bash
# Uses default 'http://backend:8000'
NODE_ENV=development
```

## Production-Ready Features

### Timeout & Retry Configuration

```typescript
export const API_CONFIG = {
  TIMEOUT: 30000,              // 30-second timeout prevents hanging
  RETRY_ATTEMPTS: 3,           // Exponential backoff retry
  RETRY_DELAY: 1000,           // 1-second base delay
  MAX_RETRY_DELAY: 30000,      // 30-second maximum delay
  
  // Performance settings
  MAX_CONCURRENT_REQUESTS: 10, // Future rate limiting support
} as const;
```

### Environment-Aware Logging

```typescript
// Logging automatically adapts to environment
ENABLE_REQUEST_LOGGING: process.env.NODE_ENV !== 'production',
ENABLE_ERROR_LOGGING: true, // Always enabled for monitoring
```

**Development Behavior**:
- ✅ Full request/response logging with emojis
- ✅ Performance timing information
- ✅ Detailed error information

**Production Behavior**:
- ❌ Request logging disabled (performance optimization)
- ✅ Error logging enabled (monitoring and debugging)
- ✅ Minimal console output

## Integration with HTTP Client

These constants are automatically used by the UnifiedHttpClient:

```typescript
import { getHttpClient } from '@/api/client/http-unified-client';
import { API_ENDPOINTS } from '@/api/constants/config';

const client = getHttpClient();

// Automatically uses:
// - 30-second timeout
// - 3-attempt retry with exponential backoff  
// - Environment-aware logging
// - Proper authentication headers

const response = await client.get(API_ENDPOINTS.USERS.LIST);
```