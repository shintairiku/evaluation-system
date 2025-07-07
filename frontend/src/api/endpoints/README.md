# API Endpoints

This directory contains functions that directly map to backend API endpoints (1:1 relationship).

## Files

### `users.ts`
User management API functions:
- `getUsers()`: Get paginated list of users
- `getUserById()`: Get specific user by ID
- `createUser()`: Create new user
- `updateUser()`: Update existing user
- `deleteUser()`: Delete user
- `getUserProfile()`: Get user profile information

### `index.ts`
Re-exports all endpoint APIs for convenient importing

## Usage Patterns

### Basic Usage
```typescript
import { authApi, usersApi } from '@/api/endpoints';

// Authentication
const signInResult = await authApi.signIn({ clerk_token: 'token123' });
const currentUser = await authApi.getCurrentUser();

// User Management
const users = await usersApi.getUsers({ page: 1, limit: 10 });
const user = await usersApi.getUserById('user-123');
```

### Error Handling
```typescript
const result = await usersApi.getUserById('user-123');

if (result.success && result.data) {
  console.log('User found:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### With TypeScript
```typescript
import type { UserCreate, ApiResponse, UserDetailResponse } from '@/api/types';

const newUser: UserCreate = {
  name: 'John Doe',
  email: 'john@example.com',
  // ... other fields
};

const result: ApiResponse<UserDetailResponse> = await usersApi.createUser(newUser);
```

## Design Principles

### 1:1 Backend Mapping
Each function corresponds directly to a backend endpoint:
```typescript
// Frontend: usersApi.getUserById('123')
// Backend:  GET /api/v1/users/123

// Frontend: usersApi.createUser(userData)
// Backend:  POST /api/v1/users
```

### Consistent Return Format
All functions return the same `ApiResponse<T>` structure:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Type Safety
All functions are fully typed with:
- Input parameter types
- Response data types
- Error handling types

### Authentication
Functions automatically include authentication headers when available through the HTTP client.

## When to Use

**Use endpoint functions when:**
- Building client-side functionality
- Need direct API access in components
- Working with form submissions
- Implementing real-time features

**Consider server actions instead when:**
- Implementing server-side rendering (SSR)
- Pre-loading data for pages
- SEO is important
- Want to reduce client-side JavaScript

## Adding New Endpoints

1. Define types in `/types/` directory
2. Add endpoint constants to `/constants/config.ts`
3. Create endpoint functions in appropriate file
4. Add to index.ts exports
5. Create corresponding server actions if needed

## Error Handling

All endpoint functions handle errors consistently:
- Network errors
- HTTP status errors
- JSON parsing errors
- Authentication failures

Errors are returned in the standardized format rather than thrown as exceptions.