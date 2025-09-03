# 📖 Hierarchy Components Usage Guide

## Overview
The `/components/hierarchy/` directory contains shared, reusable components for managing user hierarchy (supervisor/subordinate relationships) across both setup and edit contexts.

## 🏗️ Architecture

```
frontend/src/components/hierarchy/
├── HierarchyCard.tsx              # Base component with composition
├── HierarchySetupCard.tsx         # Setup context wrapper
├── HierarchyEditCard.tsx          # Edit context wrapper
├── components/                    # Shared UI components
├── hooks/                         # Shared hooks
├── types.ts                       # TypeScript types
└── index.ts                       # Barrel exports
```

## 🚀 Quick Start

### Basic Import
```typescript
import { HierarchySetupCard, HierarchyEditCard } from '@/components/hierarchy';
```

### Setup Context Usage
```typescript
import { HierarchySetupCard } from '@/components/hierarchy';

function ProfileSetup() {
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>([]);

  return (
    <HierarchySetupCard
      mode="setup"
      userName="John Doe"
      userEmail="john@example.com"
      selectedRoles={userRoles}
      allUsers={allUsers}
      selectedSupervisorId={selectedSupervisor}
      selectedSubordinateIds={selectedSubordinates}
      onSupervisorChange={setSelectedSupervisor}
      onSubordinatesChange={setSelectedSubordinates}
      getPotentialSupervisors={() => filteredSupervisors}
      getPotentialSubordinates={() => filteredSubordinates}
    />
  );
}
```

### Edit Context Usage
```typescript
import { HierarchyEditCard } from '@/components/hierarchy';

function UserEditor({ user, allUsers }: { user: UserDetailResponse, allUsers: UserDetailResponse[] }) {
  return (
    <HierarchyEditCard
      user={user}
      allUsers={allUsers}
      onUserUpdate={(updatedUser) => console.log('Updated:', updatedUser)}
      onPendingChanges={(hasPending, saveHandler, undoHandler) => {
        // Handle pending changes UI
      }}
      initialEditMode={false}
    />
  );
}
```

## 🧩 Individual Components

### SupervisorSelector
```typescript
import { SupervisorSelector } from '@/components/hierarchy';

<SupervisorSelector
  mode="setup" // or "edit"
  currentSupervisor={supervisor}
  potentialSupervisors={availableSupervisors}
  onSupervisorChange={(id) => setSupervisor(id)}
  onSupervisorRemove={() => setSupervisor(null)}
  canEdit={true}
/>
```

### SubordinateManager
```typescript
import { SubordinateManager } from '@/components/hierarchy';

<SubordinateManager
  mode="setup" // or "edit"
  currentSubordinates={subordinates}
  potentialSubordinates={availableSubordinates}
  onSubordinateAdd={(id) => addSubordinate(id)}
  onSubordinateRemove={(id) => removeSubordinate(id)}
  canEdit={true}
/>
```

## 🔧 Hooks

### useHierarchyEdit (Edit Context)
```typescript
import { useHierarchyEdit } from '@/components/hierarchy';

const {
  canEditHierarchy,
  optimisticState,
  hasPendingChanges,
  changeSupervisor,
  addSubordinate,
  removeSubordinate,
  saveAllChanges,
  rollbackChanges,
  getPotentialSupervisors,
  getPotentialSubordinates
} = useHierarchyEdit({
  user,
  allUsers,
  onUserUpdate
});
```

### useHierarchyValidation
```typescript
import { useHierarchyValidation } from '@/components/hierarchy';

const { validateChange, canBeSupervisor, canBeSubordinate } = useHierarchyValidation({ allUsers });
```

## 📋 Props Reference

### HierarchySetupCard Props
```typescript
interface HierarchySetupProps {
  mode: 'setup';
  userName: string;
  userEmail: string;
  selectedRoles: Role[];
  allUsers: UserDetailResponse[];
  selectedSupervisorId: string;
  selectedSubordinateIds: string[];
  onSupervisorChange: (supervisorId: string) => void;
  onSubordinatesChange: (subordinateIds: string[]) => void;
  getPotentialSupervisors: () => UserDetailResponse[];
  getPotentialSubordinates: () => UserDetailResponse[];
  disabled?: boolean;
}
```

### HierarchyEditCard Props
```typescript
interface HierarchyEditCardProps {
  user: UserDetailResponse;
  allUsers: UserDetailResponse[];
  isLoading?: boolean;
  onUserUpdate?: (user: UserDetailResponse) => void;
  onPendingChanges?: (hasPendingChanges: boolean, saveHandler?: () => Promise<void>, undoHandler?: () => void) => void;
  initialEditMode?: boolean;
}
```

## 🎨 Key Features

- **Composition Pattern**: Mix and match components as needed
- **Type Safety**: Full TypeScript support with proper interfaces  
- **Mode Support**: Separate setup and edit behaviors
- **Optimistic Updates**: Real-time UI feedback in edit mode
- **Validation**: Built-in hierarchy validation logic
- **Accessibility**: Proper ARIA labels and keyboard navigation

## 💡 Best Practices

1. **Use wrapper components** (HierarchySetupCard/HierarchyEditCard) for complete functionality
2. **Use individual components** when you need custom layouts
3. **Always provide proper role-based filtering** via getPotential functions
4. **Handle pending changes** appropriately in edit contexts
5. **Implement proper error handling** with toast notifications

This architecture ensures maintainable, reusable hierarchy management across your application!