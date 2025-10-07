/**
 * Stage Management Feature - Public API
 * Centralized exports for better organization and dependency management
 */

// Main components
export { default as StageManagementContainer } from './StageManagementContainer';
export { default as StageManagementView } from './StageManagementView';

// Individual components
export { default as StageGrid } from './components/StageGrid';
export { default as StageColumn } from './components/StageColumn';
export { default as UserCard } from './components/UserCard';
export { default as EditModeControls } from './components/EditModeControls';
export { default as StageManagementHeader } from './components/StageManagementHeader';
export { default as StageUserSearch } from './components/StageUserSearch';
export { default as StageEditModal } from './components/StageEditModal';

// Types
export type { StageData, UserCardData, UserStageChange } from './types';

// Hooks
export { useHydration } from './hooks/useHydration';
export { useDebounce } from './hooks/useDebounce';
export { useStageNotifications } from './hooks/useStageNotifications';

// Utils
export { getStageCardClasses, getCardHeaderClasses, getGridClasses } from './utils/classNames';

// Constants
export { STAGE_HEIGHTS, GRID_CONFIG, TRANSITIONS, DRAG_STYLES, MODAL } from './constants';