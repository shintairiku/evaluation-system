'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { SubordinatesListData, SubordinateInfo } from '@/api/types';

export interface SubordinatesCardProps {
  data: SubordinatesListData;
  isLoading?: boolean;
  className?: string;
  onSubordinateClick?: (subordinate: SubordinateInfo) => void;
}

/**
 * SubordinatesCard component for displaying subordinates list
 *
 * Displays:
 * - List of subordinates with avatars and status
 * - Progress indicators for each subordinate
 * - Urgent attention indicators
 * - Quick links to subordinate details
 */
export default function SubordinatesCard({
  data,
  isLoading = false,
  className = '',
  onSubordinateClick
}: SubordinatesCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            部下一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-32" />
                  <div className="h-3 bg-muted animate-pulse rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (subordinate: SubordinateInfo) => {
    if (subordinate.needsUrgentAttention || subordinate.isOverdue) {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (subordinate.hasReceivedFeedback) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusBadge = (subordinate: SubordinateInfo) => {
    if (subordinate.needsUrgentAttention) {
      return <Badge variant="destructive" className="text-xs">至急</Badge>;
    }
    if (subordinate.isOverdue) {
      return <Badge variant="destructive" className="text-xs">遅延</Badge>;
    }
    if (subordinate.hasReceivedFeedback) {
      return <Badge variant="default" className="text-xs bg-green-500">完了</Badge>;
    }
    if (subordinate.hasCompletedSelfAssessment) {
      return <Badge variant="secondary" className="text-xs">評価待ち</Badge>;
    }
    if (subordinate.hasSetGoals) {
      return <Badge variant="secondary" className="text-xs">進行中</Badge>;
    }
    return <Badge variant="outline" className="text-xs">未着手</Badge>;
  };

  const getCardBgColor = (subordinate: SubordinateInfo) => {
    if (subordinate.needsUrgentAttention || subordinate.isOverdue) {
      return 'border-red-200 bg-red-50';
    }
    if (subordinate.hasReceivedFeedback) {
      return 'border-green-200 bg-green-50';
    }
    return 'border-gray-200 hover:bg-gray-50';
  };

  const handleSubordinateClick = (subordinate: SubordinateInfo) => {
    if (onSubordinateClick) {
      onSubordinateClick(subordinate);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            部下一覧
          </div>
          <div className="flex items-center gap-2">
            {data.needsAttentionCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                要対応: {data.needsAttentionCount}名
              </Badge>
            )}
            <Badge variant="secondary" className="text-sm">
              {data.totalCount}名
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.subordinates.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">部下が登録されていません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.subordinates.map((subordinate) => (
              <div
                key={subordinate.userId}
                className={`
                  flex items-center gap-3 p-3 border rounded-lg
                  transition-colors duration-200 cursor-pointer
                  ${getCardBgColor(subordinate)}
                `}
                onClick={() => handleSubordinateClick(subordinate)}
              >
                {/* Avatar */}
                <Avatar className="w-10 h-10">
                  <AvatarImage src={subordinate.avatarUrl} alt={subordinate.name} />
                  <AvatarFallback className="text-xs">
                    {getInitials(subordinate.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{subordinate.name}</span>
                    {getStatusIcon(subordinate)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{subordinate.employeeCode}</span>
                    {subordinate.jobTitle && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground truncate">{subordinate.jobTitle}</span>
                      </>
                    )}
                  </div>
                  {subordinate.isOverdue && subordinate.daysUntilDeadline && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-red-600">
                        期限超過: {Math.abs(subordinate.daysUntilDeadline)}日
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {getStatusBadge(subordinate)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <Link href={`/user-profiles/${subordinate.userId}`}>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All Link */}
        {data.subordinates.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link href="/user-profiles">
                すべての部下を表示
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
export function SubordinatesCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-20" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-32" />
                <div className="h-3 bg-muted animate-pulse rounded w-24" />
              </div>
              <div className="h-6 bg-muted animate-pulse rounded w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}