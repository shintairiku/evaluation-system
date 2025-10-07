// Admin Dashboard related types

/**
 * System statistics for admin dashboard
 */
export interface SystemStatsData {
  totalUsers: number;
  totalDepartments: number;
  activeEvaluationPeriods: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated?: string;
}

/**
 * Pending approval item for admin dashboard
 */
export interface PendingApprovalItem {
  type: 'user' | 'evaluation' | 'goal' | 'feedback';
  count: number;
  priority: 'high' | 'medium' | 'low';
  label: string;
  href?: string;
}

/**
 * Pending approvals data for admin dashboard
 */
export interface PendingApprovalsData {
  items: PendingApprovalItem[];
  totalPending: number;
  lastUpdated?: string;
}

/**
 * System alert for admin dashboard
 */
export interface SystemAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  actionUrl?: string;
  actionLabel?: string;
  dismissed?: boolean;
}

/**
 * System alerts data for admin dashboard
 */
export interface SystemAlertsData {
  alerts: SystemAlert[];
  criticalCount: number;
  warningCount: number;
  lastUpdated?: string;
}

/**
 * Complete admin dashboard data structure
 */
export interface AdminDashboardData {
  systemStats: SystemStatsData;
  pendingApprovals: PendingApprovalsData;
  systemAlerts: SystemAlertsData;
  lastUpdated: string;
}

/**
 * Response structure for admin dashboard API
 */
export interface AdminDashboardResponse {
  systemStats: SystemStatsData;
  pendingApprovals: PendingApprovalsData;
  systemAlerts: SystemAlertsData;
}