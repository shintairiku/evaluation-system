'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Calendar, TrendingUp } from 'lucide-react';

import type { SystemStatsData } from '@/api/types';

export interface SystemStatsCardProps {
  data: SystemStatsData;
  isLoading?: boolean;
  className?: string;
}

/**
 * SystemStatsCard component for displaying system-wide statistics
 *
 * Displays:
 * - Total number of users in the system
 * - Total number of departments
 * - Number of active evaluation periods
 * - System health indicator
 */
export default function SystemStatsCard({
  data,
  isLoading = false,
  className = ''
}: SystemStatsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            システム統計
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
                <div className="h-6 bg-muted animate-pulse rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthColor = (health: SystemStatsData['systemHealth']) => {
    switch (health) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthLabel = (health: SystemStatsData['systemHealth']) => {
    switch (health) {
      case 'healthy':
        return '正常';
      case 'warning':
        return '注意';
      case 'critical':
        return '異常';
      default:
        return '不明';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          システム統計
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Users */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">総ユーザー数</span>
            </div>
            <Badge variant="secondary" className="text-base font-semibold">
              {data.totalUsers.toLocaleString()}人
            </Badge>
          </div>

          {/* Total Departments */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">部門数</span>
            </div>
            <Badge variant="secondary" className="text-base font-semibold">
              {data.totalDepartments}部門
            </Badge>
          </div>

          {/* Active Evaluation Periods */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">アクティブ評価期間</span>
            </div>
            <Badge variant="secondary" className="text-base font-semibold">
              {data.activeEvaluationPeriods}期間
            </Badge>
          </div>

          {/* System Health */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getHealthColor(data.systemHealth)}`} />
              <span className="text-sm font-medium">システム状態</span>
            </div>
            <Badge
              variant={data.systemHealth === 'healthy' ? 'default' : 'destructive'}
              className="text-sm font-semibold"
            >
              {getHealthLabel(data.systemHealth)}
            </Badge>
          </div>

          {/* Last Updated */}
          {data.lastUpdated && (
            <div className="text-xs text-muted-foreground text-center pt-2">
              最終更新: {new Date(data.lastUpdated).toLocaleString('ja-JP')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton component for loading state
 */
export function SystemStatsCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-20" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 bg-muted animate-pulse rounded w-32" />
              <div className="h-6 bg-muted animate-pulse rounded w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}