// Multi-role Dashboard Components
export { default as RoleTabNavigation, RoleIndicator, CompactRoleSwitcher } from './RoleTabNavigation';
export { default as TabContentContainer, clearComponentCache, getCacheStats, withLazyDashboard, preloadDashboard } from './TabContentContainer';

// Role-specific dashboards
export * from './admin';
export * from './supervisor';

// Re-export types
export type { RoleTabNavigationProps } from './RoleTabNavigation';
export type { TabContentContainerProps } from './TabContentContainer';