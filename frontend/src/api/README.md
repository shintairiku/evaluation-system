# API Layer

This directory contains the complete API integration layer for the HR Evaluation System frontend.

## Overview

The API layer provides a **server-first** approach to communicate with the FastAPI backend, using React 19's `useActionState` and Next.js Server Actions for optimal performance and developer experience.

## Folder Structure

```
src/api/
├── client/           # HTTP client configuration
├── constants/        # API configuration constants
├── endpoints/        # Direct API endpoint functions (standardized layer)
├── server-actions/   # Next.js server actions (for SSR and client components)
├── types/            # TypeScript interfaces matching backend schemas
├── utils/            # Cache utilities and helpers
└── README.md         # This file
```

## Key Features

- **Server-First Architecture**: Optimized for React 19's `useActionState` and Next.js Server Actions
- **Type Safety**: Full TypeScript support with interfaces matching backend schemas
- **Standardized API Layer**: Consistent endpoints → server actions pattern across all resources
- **Advanced Caching**: Request Memoization + Data Cache with smart revalidation
- **Built-in Loading States**: Automatic `isPending` state management via `useActionState`
- **Centralized Configuration**: Environment-based API configuration
- **Error Handling**: Consistent error handling across all API calls
- **Authentication**: Integrated Clerk authentication with automatic token handling

## Usage Patterns

### For Server Components (Data Fetching)
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

### For Client Components (Form Submission)
```typescript
'use client';
import { useActionState } from 'react';
import { createUserAction } from '@/api/server-actions';

export function CreateUserForm() {
  const actionWrapper = async (prevState: any, formData: FormData) => {
    const userData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
    };
    return await createUserAction(userData);
  };

  const [actionState, formAction, isPending] = useActionState(actionWrapper, null);

  return (
    <form action={formAction}>
      <input name="name" required />
      <input name="email" type="email" required />
      {actionState?.error && <div className="error">{actionState.error}</div>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

### For Client Components (Data Fetching)
```typescript
'use client';
import { useActionState, useEffect } from 'react';
import { getUsersAction } from '@/api/server-actions';

export function UsersWrapper() {
  const actionWrapper = async () => {
    return await getUsersAction({ page: 1, limit: 10 });
  };

  const [actionState, formAction, isPending] = useActionState(actionWrapper, null);

  useEffect(() => {
    formAction();
  }, [formAction]);

  if (isPending) return <div>Loading...</div>;
  if (!actionState?.success) return <div>Error: {actionState?.error}</div>;
  
  return <UsersList users={actionState.data.users} />;
}
```

## Page Loader Pattern (Performance)
- Prefer **one page = one loader**: add a server action under `server-actions/page-loaders.ts` that bundles everything the page needs (user/org context, periods, list data).
- Hydrate client components with the loader output instead of firing multiple server actions from the browser.
- Keep loaders serialisable (plain objects/arrays). Convert to richer structures (e.g., `Map`) inside client hooks if needed.
- Cache org/user context per request with `getCurrentUserContextAction` to avoid repeated Clerk/JWT parsing.

## Dynamic vs Static Rendering
- Default to static/ISR for informational pages that **do not depend on auth** (e.g., `/access-denied` uses `force-static`).
- Keep auth-sensitive route groups dynamic only where necessary (see `(auth)/layout.tsx` for scoped `force-dynamic`), not at the root layout level.
- Pages that call `auth()` naturally opt into dynamic rendering; avoid `force-dynamic` unless absolutely required.

## Environment Variables

Add these to your `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Architecture Principles

1. **Server-First**: Use Server Components for initial data loading, `useActionState` for client interactions
2. **Unified Actions**: Single Server Actions serve both SSR and client components via `useActionState`
3. **Type Safety**: All API interactions are fully typed with consistent interfaces
4. **Built-in State Management**: Leverage React's `isPending` instead of manual loading states
5. **Error Consistency**: Standardized error handling across all Server Actions
6. **Authentication**: Automatic token handling with Clerk integration
7. **Progressive Enhancement**: Forms work without JavaScript, enhanced with `useActionState`
8. **Performance Optimization**: Smart caching reduces API calls and improves response times

## Cache System

This API layer includes a comprehensive caching system:

- **Request Memoization**: Deduplicates API calls within the same render cycle
- **Data Cache**: Persistent caching across requests with configurable durations
- **Smart Revalidation**: Automatic cache invalidation when data changes
- **Cache Tags**: Granular cache control for related data

For detailed caching information, see [`README_CACHE.md`](./README_CACHE.md).

## Available Resources

All resources follow the standardized pattern with endpoints → server actions:

- **Authentication**: `auth.ts` - User authentication and token management
- **Users**: `users.ts` - User management and profile operations
- **Departments**: `departments.ts` - Department CRUD operations
- **Roles**: `roles.ts` - Role management and hierarchy operations
- **Stages**: `stages.ts` - User stage/level management
- **Evaluation Periods**: `evaluation-periods.ts` - Evaluation period management
- **Goals**: `goals.ts` - Goal setting and management
- **Competencies**: `competencies.ts` - Competency framework management
- **Self Assessments**: `self-assessments.ts` - Employee self-assessment operations
- **Supervisor Reviews**: `supervisor-reviews.ts` - Manager review operations
- **Supervisor Feedbacks**: `supervisor-feedbacks.ts` - Feedback management
