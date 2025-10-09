'use client';

import { useState, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import {
  PersonalProgressCard,
  PersonalProgressCardSkeleton,
  TodoTasksCard,
  TodoTasksCardSkeleton,
  DeadlineAlertsCard,
  DeadlineAlertsCardSkeleton,
  HistoryAccessCard,
  HistoryAccessCardSkeleton
} from './index';
import type {
  EmployeeDashboardData,
  TodoTask,
  DeadlineAlert,
  HistoricalPeriodSummary
} from '@/api/types';

export interface EmployeeDashboardProps {
  /** Initial dashboard data (from server action) */
  initialData?: EmployeeDashboardData;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Custom class name */
  className?: string;
  /** Custom refresh function */
  onRefresh?: () => Promise<void>;
  /** Handle task click */
  onTaskClick?: (task: TodoTask) => void;
  /** Handle alert click */
  onAlertClick?: (alert: DeadlineAlert) => void;
  /** Handle period click */
  onPeriodClick?: (period: HistoricalPeriodSummary) => void;
}

/**
 * EmployeeDashboard component - Main layout for employee dashboard
 *
 * Features:
 * - Responsive 3-column → 2-column → 1-column layout
 * - Personal progress overview
 * - TODO tasks management
 * - Deadline alerts with urgency indicators
 * - Quick access to historical data
 * - Real-time data refresh capabilities
 */
export default function EmployeeDashboard({
  initialData,
  isLoading = false,
  error = null,
  className = '',
  onRefresh,
  onTaskClick,
  onAlertClick,
  onPeriodClick
}: EmployeeDashboardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      // Error is handled by parent component - no need to log here
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
            <PersonalProgressCardSkeleton />
            <HistoryAccessCardSkeleton />
          </div>
          <div className="space-y-6">
            <TodoTasksCardSkeleton />
          </div>
          <div className="space-y-6 lg:col-span-2 xl:col-span-1">
            <DeadlineAlertsCardSkeleton />
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
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>{error}</span>
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  再試行
                </Button>
              )}
            </div>
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
          <AlertDescription>
            ダッシュボードデータを読み込めませんでした。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">マイダッシュボード</h1>
          {initialData.currentPeriod?.period?.name && (
            <p className="text-sm text-muted-foreground mt-1">
              {initialData.currentPeriod.period.name}
            </p>
          )}
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
        )}
      </div>

      {/* Current period alert if no period is active */}
      {!initialData.currentPeriod?.period && (
        <Alert>
          <AlertDescription>
            現在、アクティブな評価期間がありません。新しい評価期間が開始されるまでお待ちください。
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <PersonalProgressCard
            data={initialData.personalProgress}
            isLoading={refreshing}
          />
          <HistoryAccessCard
            data={initialData.historyAccess}
            isLoading={refreshing}
            onPeriodClick={onPeriodClick}
          />
        </div>

        {/* Middle Column */}
        <div className="space-y-6">
          <TodoTasksCard
            data={initialData.todoTasks}
            isLoading={refreshing}
            onTaskClick={onTaskClick}
          />
        </div>

        {/* Right Column (spans 2 columns on large screens) */}
        <div className="space-y-6 lg:col-span-2 xl:col-span-1">
          <DeadlineAlertsCard
            data={initialData.deadlineAlerts}
            isLoading={refreshing}
            onAlertClick={onAlertClick}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version of EmployeeDashboard for smaller layouts
 * Shows only key information without full card layouts
 */
export function CompactEmployeeDashboard({
  initialData,
  className = ''
}: {
  initialData?: EmployeeDashboardData;
  className?: string;
}) {
  if (!initialData) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PersonalProgressCard
          data={initialData.personalProgress}
          className="h-full"
        />
        <div className="space-y-4">
          {initialData.todoTasks.totalTasks > 0 && (
            <TodoTasksCard
              data={initialData.todoTasks}
              className="h-auto"
            />
          )}
          {initialData.deadlineAlerts.totalAlerts > 0 && (
            <DeadlineAlertsCard
              data={initialData.deadlineAlerts}
              className="h-auto"
            />
          )}
        </div>
      </div>
    </div>
  );
}