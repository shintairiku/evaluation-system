# Server Actions

This directory contains Next.js server actions for server-side data fetching and mutations.

## Files

### `users.ts`
User management server actions:
- `getUsersAction()`: Get paginated users for SSR
- `getUserByIdAction()`: Get specific user for SSR
- `createUserAction()`: Create user on server
- `updateUserAction()`: Update user on server
- `deleteUserAction()`: Delete user on server
### `index.ts`
Re-exports all server actions

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
All server actions are fully typed:
```typescript
export async function getUserByIdAction(userId: UUID): Promise<{
  success: boolean;
  data?: UserDetailResponse;
  error?: string;
}> {
  // Implementation
}
```

### Error Handling
Consistent error handling pattern:
```typescript
try {
  const response = await apiCall();
  
  if (!response.success) {
    return { success: false, error: response.error };
  }
  
  return { success: true, data: response.data };
} catch (error) {
  console.error('Server action error:', error);
  return { success: false, error: 'Unexpected error occurred' };
}
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

1. Create the action function with 'use server' directive
2. Add proper TypeScript types
3. Implement error handling
4. Add to appropriate file (auth.ts, users.ts, etc.)
5. Export from index.ts
6. Update documentation