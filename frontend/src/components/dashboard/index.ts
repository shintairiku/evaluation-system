/**
 * Dashboard Components
 * Central export for all dashboard-related components
 */

// Main dashboard components
export { default as EnhancedDashboard, DashboardLoadingSkeleton } from './EnhancedDashboard';
export type { EnhancedDashboardProps } from './EnhancedDashboard';

export { default as DashboardFactory, getDashboardComponent, hasDashboardForRole } from './DashboardFactory';
export type { DashboardFactoryProps, DashboardRole } from './DashboardFactory';

// Multi-role Dashboard Components
export { default as RoleTabNavigation, RoleIndicator, CompactRoleSwitcher } from './RoleTabNavigation';
export type { RoleTabNavigationProps } from './RoleTabNavigation';

export { default as TabContentContainer, getTabRenderingStats } from './TabContentContainer';
export type { TabContentContainerProps } from './TabContentContainer';

// Common UI components
export * from './common';

// Role-specific dashboards
export * from './admin';
export * from './supervisor';
export * from './employee';