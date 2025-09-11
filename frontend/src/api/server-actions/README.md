# Server Actions

This directory contains Next.js server actions for server-side data fetching and mutations. All server actions follow a standardized pattern with built-in caching, error handling, and type safety.

## Available Server Actions

### Core Resources
- **`auth.ts`** - Authentication and user session management
- **`users.ts`** - User management (CRUD operations, profile management)
- **`departments.ts`** - Department management with caching
- **`roles.ts`** - Role management with hierarchy support
- **`stages.ts`** - User stage/level management

### Evaluation System
- **`evaluation-periods.ts`** - Evaluation period lifecycle management
- **`goals.ts`** - Goal setting, tracking, and approval workflows
- **`competencies.ts`** - Competency framework management
- **`self-assessments.ts`** - Employee self-evaluation operations
- **`supervisor-reviews.ts`** - Manager review and approval workflows
- **`supervisor-feedbacks.ts`** - Feedback collection and management

### Meta
- **`evaluations.ts`** - Cross-cutting evaluation utilities
- **`index.ts`** - Re-exports all server actions for convenient importing

## Architecture Pattern

```
React Components → Server Actions → Endpoints → HTTP Client → Backend API
                             ↓
                    Cache System (Request Memoization + Data Cache)
```

## Usage

### In Server Components (Recommended)
```typescript
import { getUsersAction, getCurrentUserAction } from '@/api/server-actions';

export default async function UsersPage() {
  // These run on the server during SSR
  const [usersResult, currentUserResult] = await Promise.all([
    getUsersAction({ page: 1, limit: 10 }),
    getCurrentUserAction()
  ]);

  if (!usersResult.success) {
    return <div>Error loading users: {usersResult.error}</div>;
  }

  return (
    <div>
      <h1>Welcome, {currentUserResult.data?.name}</h1>
      <UsersList users={usersResult.data.users} />
    </div>
  );
}
```

### In Client Components (Form Actions)
```typescript
'use client';
import { createUserAction } from '@/api/server-actions';

export function CreateUserForm() {
  async function handleSubmit(formData: FormData) {
    const userData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      // ... other fields
    };

    const result = await createUserAction(userData);
    
    if (result.success) {
      // Handle success
    } else {
      // Handle error
    }
  }

  return (
    <form action={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### With useFormState Hook
```typescript
'use client';
import { useFormState } from 'react-dom';
import { createUserAction } from '@/api/server-actions';

export function CreateUserForm() {
  const [state, formAction] = useFormState(createUserAction, null);

  return (
    <form action={formAction}>
      {state?.error && <div className="error">{state.error}</div>}
      {/* form fields */}
    </form>
  );
}
```

## Key Features

### Server-Side Execution
- Run on the server, not in the browser
- Better for SEO and initial page load
- Reduce client-side JavaScript bundle size
- Direct database/API access without CORS issues

### Type Safety
All server actions are fully typed with standardized response format:
```typescript
export async function getUserByIdAction(userId: UUID): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  try {
    const response = await usersApi.getUserById(userId);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch user' };
  }
}
```

### Cache Integration
Server actions include built-in caching for optimal performance:

```typescript
// Static data with persistent caching
export const getDepartmentsAction = createFullyCachedAction(
  _getDepartmentsAction,
  'getDepartments',
  CACHE_TAGS.DEPARTMENTS
);

// Dynamic data with Request Memoization
export const getGoalsAction = cache(async (params?: GoalParams) => {
  return _getGoalsAction(params);
});
```

### Cache Revalidation
Mutation actions automatically invalidate related caches:

```typescript
export async function createDepartmentAction(data: DepartmentCreate) {
  try {
    const response = await departmentsApi.createDepartment(data);
    
    // Automatically revalidate departments cache
    revalidateTag(CACHE_TAGS.DEPARTMENTS);
    
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to create department' };
  }
}
```

### Error Handling
Consistent error handling pattern across all server actions:
```typescript
try {
  const response = await endpointApi.operation();
  
  if (!response.success || !response.data) {
    return { 
      success: false, 
      error: response.errorMessage || 'Operation failed' 
    };
  }
  
  return { success: true, data: response.data };
} catch (error) {
  console.error('Server action error:', error);
  return { 
    success: false, 
    error: 'An unexpected error occurred' 
  };
}
```

## Performance Features

### Request Memoization
Eliminates duplicate API calls within the same render cycle:

```typescript
// Multiple calls to getGoalsAction with same params = single API request
const goals1 = await getGoalsAction({ periodId: 'period-1' });
const goals2 = await getGoalsAction({ periodId: 'period-1' }); // Cached
```

### Data Cache
Persistent caching across requests with smart revalidation:

```typescript
// Cache durations by data type:
// - Static data (departments, roles): 1 hour
// - Semi-static data (evaluation periods): 30 minutes  
// - Dynamic data (goals, assessments): 5 minutes
```

### Cascading Cache Invalidation
Related data automatically updates when dependencies change:

```typescript
// Creating a goal invalidates:
revalidateTag(CACHE_TAGS.GOALS);           // Direct data
revalidateTag(CACHE_TAGS.SELF_ASSESSMENTS); // Dependent data
revalidateTag(CACHE_TAGS.SUPERVISOR_REVIEWS); // Related data
```

### Authentication
Server actions automatically handle authentication through the HTTP client and Clerk integration.

## When to Use Server Actions

**Preferred for:**
- Server-side rendering (SSR)
- Initial page data loading
- SEO-critical pages
- Form submissions
- Data mutations that should happen on server

**Consider endpoint functions instead for:**
- Client-side interactivity
- Real-time features
- Dynamic client-side updates
- When you need more control over caching

## Benefits Over Client-Side Fetching

1. **Performance**: Faster initial page loads
2. **SEO**: Search engines can see the content
3. **Security**: Sensitive operations stay on server
4. **Bundle Size**: Less JavaScript sent to client
5. **Network**: Fewer round trips for initial render

## Best Practices

1. **Error Handling**: Always wrap in try-catch
2. **Type Safety**: Use proper TypeScript types
3. **Validation**: Validate inputs on server side
4. **Logging**: Log errors for debugging
5. **Consistent Returns**: Use standardized response format

## Adding New Server Actions

1. **Create the endpoint function** in appropriate `/endpoints/*.ts` file
2. **Create the server action** with 'use server' directive
3. **Add proper TypeScript types** matching backend schemas
4. **Implement standardized error handling** pattern
5. **Add appropriate caching** (static vs dynamic data)
6. **Add cache revalidation** for mutation operations
7. **Export from index.ts**
8. **Update documentation**

### Example: Adding a New Resource

```typescript
// 1. Create endpoint in /endpoints/example.ts
export const exampleApi = {
  getExamples: async (): Promise<ApiResponse<ExampleList>> => {
    return httpClient.get<ExampleList>(API_ENDPOINTS.EXAMPLES.LIST);
  },
  
  createExample: async (data: ExampleCreate): Promise<ApiResponse<Example>> => {
    return httpClient.post<Example>(API_ENDPOINTS.EXAMPLES.CREATE, data);
  }
};

// 2. Create server action in /server-actions/examples.ts
'use server';

import { cache } from 'react';
import { revalidateTag } from 'next/cache';
import { exampleApi } from '../endpoints/examples';
import { CACHE_TAGS } from '../utils/cache';

// Read operation with caching
export const getExamplesAction = cache(async () => {
  try {
    const response = await exampleApi.getExamples();
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch examples' };
  }
});

// Mutation operation with cache revalidation
export async function createExampleAction(data: ExampleCreate) {
  try {
    const response = await exampleApi.createExample(data);
    
    // Revalidate cache
    revalidateTag(CACHE_TAGS.EXAMPLES);
    
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to create example' };
  }
}
```

## Related Documentation

- [Cache System](../README_CACHE.md) - Detailed caching implementation
- [Endpoints](../endpoints/README.md) - Endpoint layer documentation  
- [Types](../types/README.md) - TypeScript interfaces
- [Constants](../constants/README.md) - API configuration