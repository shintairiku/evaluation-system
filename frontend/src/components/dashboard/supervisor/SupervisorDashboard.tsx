'use client';

import { useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  TeamProgressCard,
  TeamProgressCardSkeleton,
  SupervisorPendingApprovalsCard,
  SupervisorPendingApprovalsCardSkeleton,
  SubordinatesCard,
  SubordinatesCardSkeleton,
  SupervisorActionsCard
} from './index';
import type {
  SupervisorDashboardData,
  SupervisorPendingApprovalItem,
  SubordinateInfo
} from '@/api/types';
import type { SupervisorAction } from './SupervisorActionsCard';

export interface SupervisorDashboardProps {
  /** Initial dashboard data (from server action) */
  initialData?: SupervisorDashboardData;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Custom class name */
  className?: string;
  /** Custom refresh function */
  onRefresh?: () => Promise<void>;
  /** Handle pending approval item click */
  onApprovalClick?: (item: SupervisorPendingApprovalItem) => void;
  /** Handle subordinate click */
  onSubordinateClick?: (subordinate: SubordinateInfo) => void;
  /** Handle quick action click */
  onQuickActionClick?: (action: SupervisorAction) => void;
}

/**
 * SupervisorDashboard component - Main layout for supervisor dashboard
 *
 * Features:
 * - Responsive 3-column → 2-column → 1-column layout
 * - Team progress overview
 * - Pending approvals management
 * - Subordinates list with status indicators
 * - Quick access to supervisor functions
 * - Real-time data refresh capabilities
 */
export default function SupervisorDashboard({
  initialData,
  isLoading = false,
  error = null,
  className = '',
  onRefresh,
  onApprovalClick,
  onSubordinateClick,
  onQuickActionClick
}: SupervisorDashboardProps) {
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
          <div className="space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded w-56" />
            <div className="h-4 bg-muted animate-pulse rounded w-40" />
          </div>
          <div className="h-10 bg-muted animate-pulse rounded w-24" />
        </div>

        {/* Dashboard grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="space-y-6">
            <TeamProgressCardSkeleton />
            <SupervisorActionsCard />
          </div>
          <div className="space-y-6">
            <SupervisorPendingApprovalsCardSkeleton />
          </div>
          <div className="space-y-6 lg:col-span-2 xl:col-span-1">
            <SubordinatesCardSkeleton />
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
            <span>上司ダッシュボードの読み込みに失敗しました</span>
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
          <h1 className="text-2xl font-bold text-foreground">上司ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            チームメンバーの評価進捗と承認タスクの管理
          </p>
          {initialData.currentPeriod && (
            <p className="text-xs text-muted-foreground mt-1">
              評価期間: {initialData.currentPeriod.name}
            </p>
          )}
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
        {/* Left Column - Team Progress & Quick Actions */}
        <div className="space-y-6">
          <TeamProgressCard
            data={initialData.teamProgress}
            isLoading={refreshing}
          />
          <SupervisorActionsCard
            onActionClick={onQuickActionClick}
          />
        </div>

        {/* Middle Column - Pending Approvals */}
        <div className="space-y-6">
          <SupervisorPendingApprovalsCard
            data={initialData.pendingApprovals}
            isLoading={refreshing}
            onItemClick={onApprovalClick}
          />
        </div>

        {/* Right Column - Subordinates List (full width on lg, single column on xl) */}
        <div className="space-y-6 lg:col-span-2 xl:col-span-1">
          <SubordinatesCard
            data={initialData.subordinatesList}
            isLoading={refreshing}
            onSubordinateClick={onSubordinateClick}
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
 * Minimal supervisor dashboard for sidebar or compact spaces
 */
export function CompactSupervisorDashboard({
  pendingCount = 0,
  subordinatesCount = 0,
  needsAttentionCount = 0,
  className = ''
}: {
  pendingCount?: number;
  subordinatesCount?: number;
  needsAttentionCount?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">上司概要</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 bg-muted rounded text-center">
          <div className="font-semibold text-lg">{pendingCount}</div>
          <div className="text-muted-foreground">承認待ち</div>
        </div>
        <div className="p-2 bg-muted rounded text-center">
          <div className="font-semibold text-lg">{subordinatesCount}</div>
          <div className="text-muted-foreground">部下数</div>
        </div>
        <div className="p-2 bg-muted rounded text-center">
          <div className="font-semibold text-lg text-red-500">{needsAttentionCount}</div>
          <div className="text-muted-foreground">要対応</div>
        </div>
      </div>
    </div>
  );
}