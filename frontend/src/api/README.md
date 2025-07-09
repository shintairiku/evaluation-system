# API Layer

This directory contains the complete API integration layer for the HR Evaluation System frontend.

## Overview

The API layer provides a structured approach to communicate with the FastAPI backend, with a focus on server-side rendering (SSR) and type safety.

## Folder Structure

```
src/api/
├── client/           # HTTP client configuration
├── constants/        # API configuration constants
├── endpoints/        # API endpoint functions (1:1 with backend routes)
├── server-actions/   # Next.js server actions for SSR
├── types/           # TypeScript interfaces matching backend schemas
└── README.md        # This file
```

## Key Features

- **Type Safety**: Full TypeScript support with interfaces matching backend schemas
- **Server-Side Focus**: Designed for Next.js App Router SSR (not client-side)
- **1:1 Mapping**: Each frontend API function corresponds to a backend endpoint
- **Centralized Configuration**: Environment-based API configuration
- **Error Handling**: Consistent error handling across all API calls
- **Authentication**: Integrated Clerk authentication with automatic token handling

## Usage Patterns

### For Server Components (Recommended)
```typescript
import { getUsersAction } from '@/api/server-actions';

export default async function UsersPage() {
  const result = await getUsersAction({ page: 1, limit: 10 });
  
  if (!result.success) {
    return <div>Error: {result.error}</div>;
  }
  
  return <div>{result.data.users.map(user => ...)}</div>;
}
```

### For Client Components (when needed)
```typescript
'use client';
import { usersApi } from '@/api/endpoints';

export function UsersList() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    usersApi.getUsers().then(result => {
      if (result.success) {
        setUsers(result.data.users);
      }
    });
  }, []);
  
  return <div>{users.map(user => ...)}</div>;
}
```

## Environment Variables

Add these to your `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Architecture Principles

1. **Server-First**: Prioritize server-side data fetching for better SEO and performance
2. **Type Safety**: All API interactions are fully typed
3. **Error Consistency**: Standardized error handling across all endpoints
4. **Authentication**: Automatic token handling with Clerk integration
5. **Separation of Concerns**: Clear separation between API logic and UI components