'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, UserCheck, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';

import type { PendingApprovalItem, PendingApprovalsData } from '@/api/types';

export interface PendingApprovalsCardProps {
  data: PendingApprovalsData;
  isLoading?: boolean;
  className?: string;
  onItemClick?: (item: PendingApprovalItem) => void;
}

/**
 * PendingApprovalsCard component for displaying pending approval items
 *
 * Displays:
 * - Pending user approvals
 * - Incomplete evaluations requiring attention
 * - Goal approvals waiting for review
 * - Feedback items needing approval
 */
export default function PendingApprovalsCard({
  data,
  isLoading = false,
  className = '',
  onItemClick
}: PendingApprovalsCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            承認待ち項目
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
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

  const getIcon = (type: PendingApprovalItem['type']) => {
    switch (type) {
      case 'user':
        return <UserCheck className="w-4 h-4" />;
      case 'evaluation':
        return <FileText className="w-4 h-4" />;
      case 'goal':
        return <Clock className="w-4 h-4" />;
      case 'feedback':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: PendingApprovalItem['priority']) => {
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

  const getPriorityBgColor = (priority: PendingApprovalItem['priority']) => {
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

  const handleItemClick = (item: PendingApprovalItem) => {
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
            承認待ち項目
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
          <div className="text-center py-6">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">承認待ちの項目はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item, index) => (
              <div
                key={`${item.type}-${index}`}
                className={`
                  flex items-center justify-between p-3 border rounded-lg
                  transition-colors duration-200 cursor-pointer
                  ${getPriorityBgColor(item.priority)}
                `}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.priority === 'high' && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-red-600">至急</span>
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={getPriorityColor(item.priority)} className="text-sm font-semibold">
                  {item.count}件
                </Badge>
              </div>
            ))}
          </div>
        )}

        {data.items.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/admin/approvals">
                すべての承認項目を表示
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
export function PendingApprovalsCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
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