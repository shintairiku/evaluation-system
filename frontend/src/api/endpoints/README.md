# DEPRECATED: API Endpoints

⚠️ **This directory is DEPRECATED and should not be used for new development.**

## Migration to Server Actions + useActionState

This project has migrated to a **server-first architecture** using React 19's `useActionState` and Next.js Server Actions. 

### Use These Instead:

- **Server Actions**: Located in `/api/server-actions/` 
- **useActionState**: For client-side interactions
- **Server Components**: For initial data loading

## Legacy Files (Do Not Use)

### `users.ts` - DEPRECATED
Use `/api/server-actions/users.ts` instead

### `index.ts` - DEPRECATED  
Import from `/api/server-actions/index.ts` instead

## Migration Guide

### OLD (Deprecated Client-Side Endpoints)
```typescript
// DON'T USE THIS
import { usersApi } from '@/api/endpoints';

const result = await usersApi.getUserById('user-123');
```

### NEW (Server Actions + useActionState)

#### For Server Components
```typescript
// ✅ USE THIS INSTEAD
import { getUserByIdAction } from '@/api/server-actions';

export default async function UserPage({ params }) {
  const result = await getUserByIdAction(params.id);
  return <div>{result.data?.name}</div>;
}
```

#### For Client Components (Forms)
```typescript
// ✅ USE THIS INSTEAD
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
      <input name="email" required />
      {actionState?.error && <div>{actionState.error}</div>}
      <button disabled={isPending}>Submit</button>
    </form>
  );
}
```

#### For Client Components (Data Fetching)  
```typescript
// ✅ USE THIS INSTEAD
'use client';
import { useActionState, useEffect } from 'react';
import { getUsersAction } from '@/api/server-actions';

export function UsersWrapper() {
  const actionWrapper = async () => await getUsersAction();
  const [actionState, formAction, isPending] = useActionState(actionWrapper, null);

  useEffect(() => { formAction(); }, [formAction]);

  if (isPending) return <div>Loading...</div>;
  return <UsersList users={actionState?.data} />;
}
```

## Why We Migrated

1. **Better Performance**: Server-side processing reduces client bundle size
2. **Built-in Loading States**: React's `isPending` eliminates manual state management
3. **Type Safety**: Unified API layer with consistent interfaces
4. **Progressive Enhancement**: Forms work without JavaScript
5. **Simpler Architecture**: No confusion between client/server data fetching

## Next Steps

1. Replace all `/api/endpoints` imports with `/api/server-actions`
2. Use `useActionState` for client-side interactions
3. Use Server Components for initial data loading
4. Remove manual loading/error state management

For detailed examples, see: `/docs/requirement-definition/02-tech/architecture/02-fe-architecture.md`