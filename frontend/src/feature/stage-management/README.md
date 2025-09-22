# Stage Management Feature

Stage management system with drag & drop functionality for moving users between different evaluation stages.

## 📁 Structure

```
stage-management/
├── components/           # UI Components
│   ├── EditModeControls.tsx    # Edit mode controls
│   ├── StageColumn.tsx          # Stage column (droppable)
│   ├── StageGrid.tsx            # Main grid with drag & drop
│   ├── StageManagementHeader.tsx # Page header
│   ├── StageUserSearch.tsx      # Search component
│   └── UserCard.tsx             # User card (draggable)
├── hooks/                # Custom hooks
│   ├── useDebounce.ts           # Debounce hook
│   └── useHydration.ts          # SSR/CSR hydration hook
├── utils/                # Utilities
│   └── classNames.ts            # CSS class generation
├── constants.ts          # Application constants
├── types.ts             # TypeScript types
├── index.ts             # Public exports
├── StageManagementContainer.tsx # Main container
└── StageManagementView.tsx      # Main view
```

## 🚀 Features

### Drag & Drop
- **Drag users** between different stages
- **Automatic edit mode** on first move operation
- **Visual feedback** during drag operations
- **Batch operations** - multiple changes before saving

### Interface
- **Collapsible columns** for better organization
- **Uniform height** per row when collapsed
- **Real-time search** by name, code, or email
- **Responsive design** with adaptive breakpoints

### State Management
- **Pending states** - unsaved changes until confirmation
- **Edit controls** - save/cancel operations
- **Server synchronization** with data
- **Robust error handling**

## 🛠️ Usage

### Basic Import
```typescript
import { StageManagementContainer } from '@/feature/stage-management';
```

### Implementation
```tsx
<StageManagementContainer
  initialStages={stages}
  initialUsers={users}
  total={total}
/>
```

## 🎨 Customization

### Configurable Constants
```typescript
// constants.ts
export const STAGE_HEIGHTS = {
  COLLAPSED: 140,
  EXPANDED: 320,
} as const;

export const SEARCH_CONFIG = {
  DEBOUNCE_DELAY: 300,
  PLACEHOLDER: 'ユーザー名、社員コード、メールで検索...',
} as const;
```

### CSS Utility Classes
```typescript
import { getStageCardClasses, getGridClasses } from './utils/classNames';
```

## 🔧 Available Hooks

### `useHydration`
```typescript
const isMounted = useHydration(); // Prevents SSR/CSR issues
```

### `useDebounce`
```typescript
const debouncedValue = useDebounce(searchQuery, 300);
```

## 📋 Types

### `StageData`
```typescript
interface StageData extends Stage {
  users: UserCardData[];
}
```

### `UserStageChange`
```typescript
interface UserStageChange {
  userId: UUID;
  fromStageId: UUID;
  toStageId: UUID;
}
```

## 🎯 Best Practices

- ✅ **Clear separation of concerns** between components
- ✅ **Custom hooks** for reusable logic  
- ✅ **Centralized constants** for configuration
- ✅ **Complete TypeScript typing**
- ✅ **SSR/CSR hydration handling**
- ✅ **Optimized performance** with debounce and memoization

## 🚦 Operation Flow

1. **Initial load** → Safe SSR/CSR rendering
2. **User search** → Real-time filtering with debounce
3. **Drag & Drop** → Edit mode activation
4. **Pending changes** → Operation accumulation
5. **Confirmation** → Batch server submission
6. **Synchronization** → Interface updates