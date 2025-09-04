// Main hierarchy components
export { default as HierarchyCard } from './HierarchyCard';
export { default as HierarchySetupCard } from './HierarchySetupCard';
export { default as HierarchyEditCard } from './HierarchyEditCard';

// Shared sub-components
export { default as SupervisorSelector } from './components/SupervisorSelector';
export { default as SubordinateManager } from './components/SubordinateManager';
export { default as HierarchyDisplay } from './components/HierarchyDisplay';
export { default as UserSearchCommand } from './components/UserSearchCommand';

// Hooks
export { useHierarchyEdit } from './hooks/useHierarchyEdit';
export { useHierarchyValidation } from './hooks/useHierarchyValidation';

// Types
export type { 
  HierarchyMode, 
  BaseHierarchyProps, 
  HierarchySetupProps, 
  HierarchyEditProps 
} from './types';