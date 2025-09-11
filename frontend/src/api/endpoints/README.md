# API Endpoints

This directory contains the standardized endpoint functions that provide 1:1 mapping to backend API routes. These endpoints are used internally by server actions to maintain a clean separation of concerns.

## Architecture Pattern

```
Server Actions → Endpoints → HTTP Client → Backend API
```

This layered approach provides:

- **Separation of Concerns**: Server actions handle business logic, endpoints handle API communication
- **Reusability**: Endpoints can be used across different server actions
- **Testability**: Endpoints can be mocked for unit testing
- **Type Safety**: Full TypeScript coverage with backend schema matching

## How It Works

Server actions use endpoints internally:

```typescript
// Example: Server Action using Endpoint
export async function getDepartmentsAction() {
  try {
    const response = await departmentsApi.getDepartments(); // ← Endpoint function
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch departments' };
  }
}
```

## Available Endpoints

All endpoints follow a consistent pattern and are organized by resource:

### Core Resources
- **`auth.ts`** - Authentication endpoints
- **`users.ts`** - User management endpoints
- **`departments.ts`** - Department CRUD operations
- **`roles.ts`** - Role management with hierarchy support
- **`stages.ts`** - User stage/level management

### Evaluation System
- **`evaluation-periods.ts`** - Evaluation period management
- **`goals.ts`** - Goal setting and tracking
- **`competencies.ts`** - Competency framework
- **`self-assessments.ts`** - Employee self-evaluations
- **`supervisor-reviews.ts`** - Manager review operations
- **`supervisor-feedbacks.ts`** - Feedback management

### Utility
- **`index.ts`** - Re-exports all endpoint APIs

## Endpoint Structure

Each endpoint file follows this pattern:

```typescript
import { getHttpClient } from '../client/http-client';
import { API_ENDPOINTS } from '../constants/config';
import type { ApiResponse, ResourceType } from '../types';

const httpClient = getHttpClient();

export const resourceApi = {
  // GET operations
  getResources: async (params?: PaginationParams): Promise<ApiResponse<ResourceList>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    
    const endpoint = queryParams.toString() 
      ? `${API_ENDPOINTS.RESOURCE.LIST}?${queryParams.toString()}`
      : API_ENDPOINTS.RESOURCE.LIST;
    
    return httpClient.get<ResourceList>(endpoint);
  },

  // POST operations
  createResource: async (data: ResourceCreate): Promise<ApiResponse<Resource>> => {
    return httpClient.post<Resource>(API_ENDPOINTS.RESOURCE.CREATE, data);
  },

  // PUT operations
  updateResource: async (id: UUID, data: ResourceUpdate): Promise<ApiResponse<Resource>> => {
    return httpClient.put<Resource>(API_ENDPOINTS.RESOURCE.UPDATE(id), data);
  },

  // DELETE operations
  deleteResource: async (id: UUID): Promise<ApiResponse<void>> => {
    return httpClient.delete(API_ENDPOINTS.RESOURCE.DELETE(id));
  },
};
```

## Key Features

### Type Safety
All endpoints are fully typed with TypeScript interfaces matching backend schemas:

```typescript
export const usersApi = {
  getUsers: async (params?: PaginationParams): Promise<ApiResponse<UserList>> => {
    // Implementation with full type safety
  }
};
```

### Error Handling
Consistent error handling through the HTTP client layer:

```typescript
// Endpoints return standardized ApiResponse<T>
const response = await usersApi.getUsers();
if (!response.success) {
  // Handle error case
  console.error(response.errorMessage);
}
```

### Parameter Handling
Standardized query parameter building:

```typescript
const queryParams = new URLSearchParams();
if (params?.page) queryParams.append('page', params.page.toString());
if (params?.limit) queryParams.append('limit', params.limit.toString());
```

## Usage Guidelines

### ✅ **Recommended Usage**
```typescript
// In Server Actions (internal use)
import { departmentsApi } from '../endpoints/departments';

export async function getDepartmentsAction() {
  const response = await departmentsApi.getDepartments();
  return { success: response.success, data: response.data };
}
```

### ❌ **Not Recommended**
```typescript
// Don't use endpoints directly in components
import { departmentsApi } from '@/api/endpoints/departments';

export function Component() {
  // Use server actions instead
}
```

## Testing

Endpoints can be easily mocked for unit testing:

```typescript
// Mock endpoint for testing
jest.mock('@/api/endpoints/users', () => ({
  usersApi: {
    getUsers: jest.fn().mockResolvedValue({
      success: true,
      data: { items: [], total: 0 }
    })
  }
}));
```

## Integration with Cache System

Endpoints work seamlessly with the caching system through server actions:

```typescript
// Server action with caching
export const getDepartmentsAction = createFullyCachedAction(
  async () => {
    const response = await departmentsApi.getDepartments(); // ← Endpoint
    return { success: true, data: response.data };
  },
  'getDepartments',
  CACHE_TAGS.DEPARTMENTS
);
```

## Related Documentation

- [Server Actions](../server-actions/README.md) - How endpoints are used in server actions
- [Cache System](../README_CACHE.md) - Caching implementation details
- [Types](../types/README.md) - TypeScript interfaces used by endpoints