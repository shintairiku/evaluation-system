// Supervisor Dashboard Components Barrel File

export { default as SupervisorDashboard, CompactSupervisorDashboard } from './SupervisorDashboard';
export type { SupervisorDashboardProps } from './SupervisorDashboard';

export { default as TeamProgressCard, TeamProgressCardSkeleton } from './TeamProgressCard';
export type { TeamProgressCardProps } from './TeamProgressCard';

export { default as SupervisorPendingApprovalsCard, SupervisorPendingApprovalsCardSkeleton } from './SupervisorPendingApprovalsCard';
export type { SupervisorPendingApprovalsCardProps } from './SupervisorPendingApprovalsCard';

export { default as SubordinatesCard, SubordinatesCardSkeleton } from './SubordinatesCard';
export type { SubordinatesCardProps } from './SubordinatesCard';

export { default as SupervisorActionsCard, CompactSupervisorActionsCard } from './SupervisorActionsCard';
export type { SupervisorActionsCardProps, SupervisorAction } from './SupervisorActionsCard';