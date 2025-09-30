'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Target, MessageSquare, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { SupervisorPendingApprovalItem, SupervisorPendingApprovalsData } from '@/api/types';

export interface SupervisorPendingApprovalsCardProps {
  data: SupervisorPendingApprovalsData;
  isLoading?: boolean;
  className?: string;
  onItemClick?: (item: SupervisorPendingApprovalItem) => void;
}

/**
 * SupervisorPendingApprovalsCard component for displaying pending approval items
 *
 * Displays:
 * - Goal approval pending items
 * - Evaluation feedback pending items
 * - Direct links to approval pages
 * - Priority indicators
 */
export default function SupervisorPendingApprovalsCard({
  data,
  isLoading = false,
  className = '',
  onItemClick
}: SupervisorPendingApprovalsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            承認待ちタスク
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-24" />
                </div>
                <div className="h-6 bg-muted animate-pulse rounded w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: SupervisorPendingApprovalItem['type']) => {
    switch (type) {
      case 'goal':
        return <Target className="w-4 h-4" />;
      case 'feedback':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: SupervisorPendingApprovalItem['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPriorityBgColor = (priority: SupervisorPendingApprovalItem['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50 hover:bg-red-100';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100';
      case 'low':
        return 'border-gray-200 bg-gray-50 hover:bg-gray-100';
      default:
        return 'border-gray-200 bg-gray-50 hover:bg-gray-100';
    }
  };

  const handleItemClick = (item: SupervisorPendingApprovalItem) => {
    if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            承認待ちタスク
          </div>
          {data.totalPending > 0 && (
            <Badge variant="destructive" className="text-sm">
              {data.totalPending}件
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">承認待ちのタスクはありません</p>
            <p className="text-xs text-muted-foreground mt-1">素晴らしい！すべてのタスクが完了しています</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item, index) => (
              <div
                key={`${item.type}-${index}`}
                className={`
                  flex items-center justify-between p-4 border rounded-lg
                  transition-colors duration-200
                  ${getPriorityBgColor(item.priority)}
                  ${item.href ? 'cursor-pointer' : ''}
                `}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-muted-foreground">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.priority === 'high' && (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    {item.overdueCount && item.overdueCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-red-600">遅延: {item.overdueCount}件</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getPriorityColor(item.priority)} className="text-sm font-semibold">
                    {item.count}件
                  </Badge>
                  {item.href && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      asChild
                    >
                      <Link href={item.href}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {data.items.length > 0 && (
          <div className="mt-6 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/(evaluation)/(supervisor)/goal-review">
                <Target className="w-4 h-4 mr-2" />
                目標承認
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/(evaluation)/(supervisor)/evaluation-feedback">
                <MessageSquare className="w-4 h-4 mr-2" />
                評価フィードバック
              </Link>
            </Button>
          </div>
        )}

        {/* Last Updated */}
        {data.lastUpdated && (
          <div className="text-xs text-muted-foreground text-center mt-3">
            最終更新: {new Date(data.lastUpdated).toLocaleString('ja-JP')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton component for loading state
 */
export function SupervisorPendingApprovalsCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-28" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded w-32" />
              </div>
              <div className="h-6 bg-muted animate-pulse rounded w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}