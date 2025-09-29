// Multi-role and State Management Hooks
export { useUserRoles, ROLE_MAPPING, DASHBOARD_ROLE_MAPPING } from './useUserRoles';
export { useTabState, useSimpleTabState } from './useTabState';

// Re-export types
export type { UserRole, UseUserRolesReturn } from './useUserRoles';
export type { UseTabStateOptions, UseTabStateReturn } from './useTabState';