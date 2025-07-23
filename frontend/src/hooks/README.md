# React Hooks Documentation

## Overview

This directory contains custom React hooks for the HR Evaluation System. These hooks provide reusable logic for common patterns including state management, user interface interactions, API operations, and optimistic updates.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Core Hooks](#core-hooks)
  - [useLoading](#useloading)
  - [useOptimisticUpdate](#useoptimisticupdate)
  - [useProfileRedirect](#useprofileredirect)
  - [useViewMode](#useviewmode)
  - [useErrorHandler](#useerrorhandler)
- [Hook Categories](#hook-categories)
- [Usage Patterns](#usage-patterns)
- [Best Practices](#best-practices)
- [Testing Hooks](#testing-hooks)

## Quick Reference

| Hook | Purpose | Location | Complexity |
|------|---------|----------|------------|
| `useLoading` | Loading state management | `hooks/useLoading.ts` | 🟡 Medium |
| `useOptimisticUpdate` | Optimistic UI updates | `hooks/useOptimisticUpdate.ts` | 🔴 Advanced |
| `useProfileRedirect` | Profile completion routing | `hooks/useProfileRedirect.ts` | 🟢 Simple |
| `useViewMode` | UI view state management | `feature/user-profiles/hooks/useViewMode.ts` | 🟢 Simple |
| `useErrorHandler` | Error handling utilities | `utils/error-handling.ts` | 🟡 Medium |
| `useLoadingContext` | Global loading context | `context/LoadingContext.tsx` | 🟡 Medium |

## Core Hooks

### useLoading

**Purpose**: Manages loading states for components with automatic cleanup and global state synchronization.

**Location**: `src/hooks/useLoading.ts`

**Key Features**:
- Component-level loading state management
- Global loading context integration  
- Automatic cleanup on unmount
- Error handling integration
- Multiple concurrent loading operations

#### Basic Usage

```typescript
import { useLoading } from '@/hooks/useLoading';

function MyComponent() {
  const { isLoading, withLoading } = useLoading('my-operation');

  const handleSave = async () => {
    await withLoading(async () => {
      await saveData();
    }, {
      onError: (error) => console.error('Save failed:', error)
    });
  };

  return (
    <button 
      onClick={handleSave} 
      disabled={isLoading}
    >
      {isLoading ? 'Saving...' : 'Save'}
    </button>
  );
}
```

#### Advanced Usage - Multiple Loading States

```typescript
import { useMultipleLoading } from '@/hooks/useLoading';

function DataManager() {
  const { setLoading, isLoading, withLoading } = useMultipleLoading('data-manager');

  const loadUsers = () => withLoading('users', fetchUsers);
  const loadProjects = () => withLoading('projects', fetchProjects);

  return (
    <div>
      <button disabled={isLoading('users')}>
        {isLoading('users') ? 'Loading Users...' : 'Load Users'}
      </button>
      <button disabled={isLoading('projects')}>
        {isLoading('projects') ? 'Loading Projects...' : 'Load Projects'}  
      </button>
    </div>
  );
}
```

#### API Reference

```typescript
interface UseLoadingReturn {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  withLoading: <T>(
    asyncOperation: () => Promise<T>,
    options?: UseLoadingOptions
  ) => Promise<T>;
  startLoading: () => void;
  stopLoading: () => void;
}
```

---

### useOptimisticUpdate

**Purpose**: Provides optimistic UI updates with automatic rollback capabilities for better user experience.

**Location**: `src/hooks/useOptimisticUpdate.ts`

**Key Features**:
- Immediate UI updates
- Automatic rollback on failure
- Toast notification integration
- Concurrent update handling
- Error recovery mechanisms

#### Basic Usage

```typescript
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';

function UserProfile({ user }) {
  const profileUpdate = useOptimisticUpdate(user, {
    optimisticUpdate: (current) => ({
      ...current,
      name: newName // Updates immediately
    }),
    asyncOperation: async () => {
      return await updateUserProfile(user.id, { name: newName });
    },
    successMessage: 'プロフィールを更新しました',
    errorMessage: 'プロフィールの更新に失敗しました'
  });

  const handleUpdate = async (newName: string) => {
    try {
      await profileUpdate.execute();
    } catch (error) {
      // UI automatically rolled back
      console.error('Update failed:', error);
    }
  };

  return (
    <div>
      <h1>{profileUpdate.state.name}</h1>
      {profileUpdate.isPending && <span>更新中...</span>}
      <button onClick={() => handleUpdate('新しい名前')}>
        名前を更新
      </button>
    </div>
  );
}
```

#### Helper Hooks

**useOptimisticList**: Simplified list operations
```typescript
import { useOptimisticList } from '@/hooks/useOptimisticUpdate';

function TodoList({ todos }) {
  const { add, remove, update } = useOptimisticList(todos);
  
  const addTodo = add(
    newTodo, 
    () => createTodoAPI(newTodo)
  );

  return (
    <div>
      {addTodo.state.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}
```

**useOptimisticForm**: Form submission with optimistic updates
```typescript
import { useOptimisticForm } from '@/hooks/useOptimisticUpdate';

function ContactForm() {
  const { submitOptimistically, isOptimistic } = useOptimisticForm(
    submitContactForm,
    {
      successMessage: 'メッセージを送信しました',
      onSuccess: () => router.push('/success')
    }
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      submitOptimistically(formData);
    }}>
      <button type="submit" disabled={isOptimistic}>
        {isOptimistic ? '送信中...' : '送信'}
      </button>
    </form>
  );
}
```

#### API Reference

```typescript
interface OptimisticUpdateReturn<T> {
  state: T;                    // Current state (with optimistic updates)
  isPending: boolean;          // Whether an operation is in progress  
  execute: () => Promise<T>;   // Execute optimistic update
  rollback: () => void;        // Manually rollback to previous state
  reset: (newState: T) => void; // Reset to new initial state
}
```

---

### useProfileRedirect

**Purpose**: Handles automatic redirection based on user profile completion status.

**Location**: `src/hooks/useProfileRedirect.ts`

**Key Features**:
- Automatic profile completion checking
- Clerk metadata integration
- Smart routing logic
- Loading state awareness

#### Usage

```typescript
import { useProfileRedirect } from '@/hooks/useProfileRedirect';

function DashboardPage() {
  const { isLoaded, user } = useProfileRedirect();

  // Hook automatically redirects:
  // - Incomplete profiles → /setup
  // - Pending approval → /setup/confirmation
  
  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  return <DashboardContent user={user} />;
}
```

#### API Reference

```typescript
interface UseProfileRedirectReturn {
  isLoaded: boolean;  // Clerk loading state
  user: User | null;  // Current user object
}
```

---

### useViewMode

**Purpose**: Manages view mode state for UI components (table, gallery, organization views).

**Location**: `src/feature/user-profiles/hooks/useViewMode.ts`

**Key Features**:
- Type-safe view mode management
- Default mode support
- Simple state management

#### Usage

```typescript
import { useViewMode, type ViewMode } from '@/feature/user-profiles/hooks/useViewMode';

function UserProfilesPage() {
  const { viewMode, setViewMode } = useViewMode('table'); // default to table

  return (
    <div>
      <ViewModeSelector 
        currentMode={viewMode} 
        onModeChange={setViewMode}
      />
      
      {viewMode === 'table' && <TableView />}
      {viewMode === 'gallery' && <GalleryView />}
      {viewMode === 'organization' && <OrganizationView />}
    </div>
  );
}
```

#### API Reference

```typescript
type ViewMode = 'table' | 'gallery' | 'organization';

interface UseViewModeReturn {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}
```

---

### useErrorHandler

**Purpose**: Provides centralized error handling utilities with logging and standardized error processing.

**Location**: `src/utils/error-handling.ts`

**Key Features**:
- Standardized error processing
- API response error handling  
- Error logging integration
- Type-safe error handling

#### Usage

```typescript
import { useErrorHandler } from '@/utils/error-handling';

function DataComponent() {
  const { handleError, handleApiError } = useErrorHandler();

  const loadData = async () => {
    try {
      const response = await fetchUserData();
      
      if (!response.success) {
        const appError = handleApiError(response, 'user-data-fetch');
        // Error logged automatically, toast shown
        return;
      }
      
      setData(response.data);
    } catch (error) {
      const appError = handleError(error, 'user-data-fetch');
      // Error logged automatically
    }
  };

  return <div>{/* Component JSX */}</div>;
}
```

#### API Reference

```typescript
interface UseErrorHandlerReturn {
  handleError: (error: unknown, context?: string) => AppError;
  handleApiError: <T>(response: ApiResponse<T>, context?: string) => AppError;
}
```

---

### useLoadingContext

**Purpose**: Provides access to global loading state management context.

**Location**: `src/context/LoadingContext.tsx`

**Key Features**:
- Global loading state management
- Multiple concurrent loading operations
- Key-based loading identification
- Context provider integration

#### Usage

```typescript
import { useLoadingContext } from '@/context/LoadingContext';

function GlobalLoadingIndicator() {
  const { isAnyLoading, loadingStates, clearAllLoading } = useLoadingContext();

  if (!isAnyLoading) return null;

  return (
    <div className="fixed top-4 right-4">
      <div className="bg-blue-500 text-white p-2 rounded">
        {Object.keys(loadingStates).length} operations in progress...
        <button onClick={clearAllLoading}>Cancel All</button>
      </div>
    </div>
  );
}
```

---

## Hook Categories

### 🎯 **State Management Hooks**
- `useLoading` - Loading state management
- `useViewMode` - UI view state
- `useLoadingContext` - Global state context

### 🚀 **Performance & UX Hooks**  
- `useOptimisticUpdate` - Optimistic UI updates
- `useOptimisticList` - List operations with optimistic updates
- `useOptimisticForm` - Form submissions with optimistic updates

### 🔐 **Authentication & Routing Hooks**
- `useProfileRedirect` - Profile-based routing
- `useAuthSync` - Authentication synchronization

### 🛠️ **Utility Hooks**
- `useErrorHandler` - Error handling utilities

## Usage Patterns

### 1. **Component-Level Loading**
```typescript
function SaveButton({ onSave }) {
  const { isLoading, withLoading } = useLoading('save-operation');
  
  const handleClick = () => withLoading(onSave);
  
  return (
    <LoadingButton 
      loading={isLoading}
      onClick={handleClick}
    >
      Save
    </LoadingButton>
  );
}
```

### 2. **Optimistic Updates with Fallback**
```typescript
function LikeButton({ post }) {
  const likeUpdate = useOptimisticUpdate(post, {
    optimisticUpdate: (current) => ({
      ...current,
      liked: !current.liked,
      likeCount: current.liked ? current.likeCount - 1 : current.likeCount + 1
    }),
    asyncOperation: () => toggleLike(post.id),
    onError: () => toast.error('いいねに失敗しました')
  });

  return (
    <button 
      onClick={() => likeUpdate.execute()}
      disabled={likeUpdate.isPending}
    >
      {likeUpdate.state.liked ? '❤️' : '🤍'} {likeUpdate.state.likeCount}
    </button>
  );
}
```

### 3. **Form with Auto-Save**
```typescript
function AutoSaveForm({ initialData }) {
  const [formData, setFormData] = useState(initialData);
  const { isLoading } = useLoading('auto-save');
  
  const autoSave = useOptimisticUpdate(formData, {
    optimisticUpdate: (current) => current,
    asyncOperation: () => saveFormData(formData),
    successMessage: '自動保存しました',
    enableToasts: false // Silent auto-save
  });

  // Auto-save on form changes
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSave.execute();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [formData]);

  return (
    <form>
      {/* Form fields */}
      {isLoading && <span>保存中...</span>}
    </form>
  );
}
```

### 4. **Error Boundary Integration**
```typescript
function DataLoader() {
  const { handleError } = useErrorHandler();
  const { withLoading } = useLoading('data-load');

  const loadData = async () => {
    try {
      await withLoading(fetchData);
    } catch (error) {
      const appError = handleError(error, 'data-loader');
      // Error automatically logged and handled
      throw appError; // Re-throw for error boundary
    }
  };

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <DataDisplay onLoad={loadData} />
    </ErrorBoundary>
  );
}
```

## Best Practices

### ✅ **Do's**

1. **Use descriptive loading keys**
```typescript
// ✅ Good: Descriptive and unique
const { isLoading } = useLoading('user-profile-save');
const { isLoading: isDeleting } = useLoading('user-profile-delete');

// ❌ Avoid: Generic or unclear
const { isLoading } = useLoading('loading');
```

2. **Handle errors appropriately**
```typescript
// ✅ Good: Comprehensive error handling
const optimisticUpdate = useOptimisticUpdate(state, {
  optimisticUpdate: (current) => ({ ...current, ...updates }),
  asyncOperation: () => updateData(updates),
  onError: (error, rollbackState) => {
    logError(error);
    showErrorNotification(error.message);
  }
});
```

3. **Use appropriate hook for the use case**
```typescript
// ✅ Good: Use optimistic updates for user actions
const deleteUpdate = useOptimisticUpdate(items, {
  optimisticUpdate: (items) => items.filter(i => i.id !== deleteId),
  asyncOperation: () => deleteItem(deleteId)
});

// ✅ Good: Use regular loading for data fetching  
const { withLoading } = useLoading('data-fetch');
const loadData = () => withLoading(fetchData);
```

### ❌ **Don'ts**

1. **Don't overuse optimistic updates**
```typescript
// ❌ Avoid: Optimistic updates for data fetching
const fetchUpdate = useOptimisticUpdate(null, {
  optimisticUpdate: () => null, // Doesn't make sense
  asyncOperation: fetchData
});

// ✅ Better: Use regular loading for fetching
const { isLoading, withLoading } = useLoading('data-fetch');
```

2. **Don't ignore cleanup**
```typescript
// ❌ Avoid: Memory leaks
useEffect(() => {
  loadData(); // Missing cleanup
}, []);

// ✅ Good: Proper cleanup
useEffect(() => {
  const { withLoading } = useLoading('component-data');
  
  withLoading(loadData);
  
  return () => {
    // useLoading handles cleanup automatically
  };
}, []);
```

3. **Don't use hooks conditionally**
```typescript
// ❌ Avoid: Conditional hook usage
if (shouldLoad) {
  const { isLoading } = useLoading('conditional'); // Breaks rules of hooks
}

// ✅ Good: Always call hooks, conditionally execute logic
const { isLoading, withLoading } = useLoading('data-load');

const loadData = () => {
  if (shouldLoad) {
    withLoading(fetchData);
  }
};
```

## Testing Hooks

### Unit Testing Example

```typescript
import { renderHook, act } from '@testing-library/react';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';

describe('useOptimisticUpdate', () => {
  it('should update state optimistically', async () => {
    const mockApiCall = jest.fn().mockResolvedValue({ id: 1, name: 'Updated' });
    
    const { result } = renderHook(() => 
      useOptimisticUpdate(
        { id: 1, name: 'Original' },
        {
          optimisticUpdate: (state) => ({ ...state, name: 'Optimistic' }),
          asyncOperation: mockApiCall
        }
      )
    );

    expect(result.current.state.name).toBe('Original');

    await act(async () => {
      await result.current.execute();
    });

    expect(mockApiCall).toHaveBeenCalled();
    expect(result.current.state.name).toBe('Updated');
  });
});
```

### Integration Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoadingProvider } from '@/context/LoadingContext';

function TestComponent() {
  const { isLoading, withLoading } = useLoading('test');
  
  const handleClick = () => withLoading(() => 
    new Promise(resolve => setTimeout(resolve, 1000))
  );

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Click me'}
    </button>
  );
}

test('loading hook integration', async () => {
  render(
    <LoadingProvider>
      <TestComponent />
    </LoadingProvider>
  );

  const button = screen.getByText('Click me');
  
  fireEvent.click(button);
  
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('Click me')).toBeInTheDocument();
  }, { timeout: 2000 });
});
```

## Performance Considerations

- **Memoization**: Use `useMemo` and `useCallback` with hooks that create expensive objects
- **Cleanup**: All hooks automatically handle cleanup on unmount
- **Re-renders**: Hooks are optimized to minimize unnecessary re-renders
- **Memory**: Loading states are automatically cleaned up when components unmount

## Contributing

When creating new hooks:

1. **Follow naming convention**: `use[PascalCase]`
2. **Add TypeScript types**: Full type safety for parameters and return values  
3. **Include JSDoc comments**: Document purpose, parameters, and return values
4. **Add tests**: Unit tests and integration tests where applicable
5. **Update this README**: Add documentation for new hooks

## Migration Guide

For upgrading from older hook versions, see individual hook documentation for breaking changes and migration paths.

---

This documentation covers all custom hooks in the HR Evaluation System. Each hook is designed to provide specific functionality while maintaining consistency and reusability across the application.