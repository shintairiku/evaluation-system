/**
 * Common Dashboard Components
 * Shared UI components used across all dashboard types
 */

export { default as DashboardCard, DashboardCardSkeleton } from './DashboardCard';
export type { DashboardCardProps } from './DashboardCard';

export { default as StatisticsBadge, StatisticsGroup } from './StatisticsBadge';
export type { StatisticsBadgeProps, StatisticsGroupProps } from './StatisticsBadge';

export { default as AlertIndicator, AlertIndicatorGroup } from './AlertIndicator';
export type { AlertIndicatorProps, AlertIndicatorGroupProps, AlertSeverity } from './AlertIndicator';

export { default as QuickActionButton, QuickActionButtonGroup } from './QuickActionButton';
export type { QuickActionButtonProps, QuickActionButtonGroupProps } from './QuickActionButton';