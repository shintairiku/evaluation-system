'use client';

import { useState, useCallback } from 'react';
import AdminDashboard from './AdminDashboard';
import { getAdminDashboardDataAction, dismissAlertAction } from '@/api/server-actions';
import type {
  AdminDashboardData,
  PendingApprovalItem,
  SystemAlert
} from '@/api/types';
import type { QuickAction } from './QuickActionsCard';

export interface AdminDashboardContainerProps {
  /** Initial data from server action */
  initialData?: AdminDashboardData;
  /** Custom class name */
  className?: string;
}

/**
 * Container component that handles admin dashboard data fetching and state management
 * Use this component when you need client-side data fetching and state management
 *
 * For server-side rendering, use AdminDashboard directly with server action data
 */
export default function AdminDashboardContainer({
  initialData,
  className = ''
}: AdminDashboardContainerProps) {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getAdminDashboardDataAction();

      if (result.success && result.data) {
        setDashboardData(result.data);
      } else {
        setError(result.errorMessage || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApprovalClick = useCallback((item: PendingApprovalItem) => {
    // Navigate to the appropriate approval page
    if (item.href) {
      window.location.href = item.href;
    } else {
      // Fallback navigation based on item type
      const baseUrls = {
        user: '/admin/users?status=pending',
        evaluation: '/admin/evaluations?status=pending',
        goal: '/admin/goals?status=pending',
        feedback: '/admin/feedback?status=pending'
      };
      window.location.href = baseUrls[item.type] || '/admin';
    }
  }, []);

  const handleAlertClick = useCallback((alert: SystemAlert) => {
    // Navigate to alert details or action URL
    if (alert.actionUrl) {
      window.location.href = alert.actionUrl;
    }
    // No default action needed - alert click is informational
  }, []);

  const handleDismissAlert = useCallback(async (alertId: string) => {
    if (!dashboardData) return;

    try {
      const result = await dismissAlertAction(alertId);

      if (result.success) {
        // Remove the dismissed alert from local state
        setDashboardData(prev => {
          if (!prev) return prev;

          return {
            ...prev,
            systemAlerts: {
              ...prev.systemAlerts,
              alerts: prev.systemAlerts.alerts.map(alert =>
                alert.id === alertId ? { ...alert, dismissed: true } : alert
              ),
              criticalCount: prev.systemAlerts.alerts.filter(
                alert => alert.id !== alertId && alert.type === 'critical'
              ).length,
              warningCount: prev.systemAlerts.alerts.filter(
                alert => alert.id !== alertId && alert.type === 'warning'
              ).length
            }
          };
        });
      } else {
        // Alert dismissal failed - could show a toast notification
        setError('アラートの非表示に失敗しました');
      }
    } catch (err) {
      // Error dismissing alert - could show a toast notification
      setError('アラートの非表示中にエラーが発生しました');
    }
  }, [dashboardData]);

  const handleQuickActionClick = useCallback((action: QuickAction) => {
    // Navigate to the action URL
    window.location.href = action.href;
  }, []);

  return (
    <AdminDashboard
      initialData={dashboardData}
      isLoading={isLoading}
      error={error}
      className={className}
      onRefresh={handleRefresh}
      onApprovalClick={handleApprovalClick}
      onAlertClick={handleAlertClick}
      onDismissAlert={handleDismissAlert}
      onQuickActionClick={handleQuickActionClick}
    />
  );
}

/**
 * Server-side example usage:
 *
 * ```tsx
 * // In your page component (server component)
 * import { getAdminDashboardDataAction } from '@/api/server-actions';
 * import { AdminDashboard } from '@/components/dashboard';
 *
 * export default async function AdminPage() {
 *   const result = await getAdminDashboardDataAction();
 *
 *   if (!result.success) {
 *     return <div>Error loading dashboard</div>;
 *   }
 *
 *   return (
 *     <AdminDashboard
 *       initialData={result.data}
 *       onRefresh={async () => {
 *         'use server';
 *         // Handle server-side refresh
 *       }}
 *     />
 *   );
 * }
 * ```
 */