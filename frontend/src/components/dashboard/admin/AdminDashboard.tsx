'use client';

import { useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  SystemStatsCard,
  SystemStatsCardSkeleton,
  PendingApprovalsCard,
  PendingApprovalsCardSkeleton,
  SystemAlertsCard,
  SystemAlertsCardSkeleton,
  QuickActionsCard
} from './index';
import type {
  AdminDashboardData,
  PendingApprovalItem,
  SystemAlert
} from '@/api/types';
import type { QuickAction } from './QuickActionsCard';

export interface AdminDashboardProps {
  /** Initial dashboard data (from server action) */
  initialData?: AdminDashboardData;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Custom class name */
  className?: string;
  /** Custom refresh function */
  onRefresh?: () => Promise<void>;
  /** Handle pending approval item click */
  onApprovalClick?: (item: PendingApprovalItem) => void;
  /** Handle system alert click */
  onAlertClick?: (alert: SystemAlert) => void;
  /** Handle alert dismissal */
  onDismissAlert?: (alertId: string) => void;
  /** Handle quick action click */
  onQuickActionClick?: (action: QuickAction) => void;
}

/**
 * AdminDashboard component - Main layout for admin dashboard
 *
 * Features:
 * - Responsive 3-column → 2-column → 1-column layout
 * - System statistics overview
 * - Pending approvals management
 * - System alerts monitoring
 * - Quick access to admin functions
 * - Real-time data refresh capabilities
 */
export default function AdminDashboard({
  initialData,
  isLoading = false,
  error = null,
  className = '',
  onRefresh,
  onApprovalClick,
  onAlertClick,
  onDismissAlert,
  onQuickActionClick
}: AdminDashboardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 bg-muted animate-pulse rounded w-48" />
          <div className="h-10 bg-muted animate-pulse rounded w-24" />
        </div>

        {/* Dashboard grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="space-y-6">
            <SystemStatsCardSkeleton />
            <QuickActionsCard />
          </div>
          <div className="space-y-6">
            <PendingApprovalsCardSkeleton />
          </div>
          <div className="space-y-6 lg:col-span-2 xl:col-span-1">
            <SystemAlertsCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>管理者ダッシュボードの読み込みに失敗しました</span>
            <span className="text-xs opacity-80">{error}</span>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-fit"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                再試行
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No data state
  if (!initialData) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ダッシュボードデータが利用できません
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">管理者ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            システム全体の管理と監視
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
        )}
      </div>

      {/* Dashboard Grid - Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Left Column - Stats & Quick Actions */}
        <div className="space-y-6">
          <SystemStatsCard
            data={initialData.systemStats}
            isLoading={refreshing}
          />
          <QuickActionsCard
            onActionClick={onQuickActionClick}
          />
        </div>

        {/* Middle Column - Pending Approvals */}
        <div className="space-y-6">
          <PendingApprovalsCard
            data={initialData.pendingApprovals}
            isLoading={refreshing}
            onItemClick={onApprovalClick}
          />
        </div>

        {/* Right Column - System Alerts (full width on lg, single column on xl) */}
        <div className="space-y-6 lg:col-span-2 xl:col-span-1">
          <SystemAlertsCard
            data={initialData.systemAlerts}
            isLoading={refreshing}
            onAlertClick={onAlertClick}
            onDismissAlert={onDismissAlert}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center pt-4 border-t">
        最終更新: {new Date(initialData.lastUpdated).toLocaleString('ja-JP')}
      </div>
    </div>
  );
}

/**
 * Minimal admin dashboard for sidebar or compact spaces
 */
export function CompactAdminDashboard({
  pendingCount = 0,
  alertCount = 0,
  className = ''
}: {
  pendingCount?: number;
  alertCount?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">管理者概要</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-muted rounded text-center">
          <div className="font-semibold text-lg">{pendingCount}</div>
          <div className="text-muted-foreground">承認待ち</div>
        </div>
        <div className="p-2 bg-muted rounded text-center">
          <div className="font-semibold text-lg">{alertCount}</div>
          <div className="text-muted-foreground">アラート</div>
        </div>
      </div>
    </div>
  );
}