'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Target, FileText, CheckCircle, AlertCircle } from 'lucide-react';

import type { TeamProgressData } from '@/api/types';

export interface TeamProgressCardProps {
  data: TeamProgressData;
  isLoading?: boolean;
  className?: string;
}

/**
 * TeamProgressCard component for displaying team evaluation progress
 *
 * Displays:
 * - Total subordinates count
 * - Goal setting progress with progress bar
 * - Self-assessment completion progress
 * - Review/Feedback completion progress
 * - Subordinates needing attention
 */
export default function TeamProgressCard({
  data,
  isLoading = false,
  className = ''
}: TeamProgressCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            チーム進捗状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-muted animate-pulse rounded w-32" />
                  <div className="h-4 bg-muted animate-pulse rounded w-16" />
                </div>
                <div className="h-2 bg-muted animate-pulse rounded w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getProgressColorClass = (percentage: number): string => {
    if (percentage >= 80) return '[&>[data-slot=progress-indicator]]:bg-green-500';
    if (percentage >= 50) return '[&>[data-slot=progress-indicator]]:bg-yellow-500';
    return '[&>[data-slot=progress-indicator]]:bg-red-500';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            チーム進捗状況
          </div>
          <Badge variant="secondary" className="text-sm">
            {data.totalSubordinates}名
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Goal Setting Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">目標設定</span>
              </div>
              <span className="text-muted-foreground">
                {data.goalsSetCount}/{data.totalSubordinates}名
                <span className="ml-1 font-semibold">({data.goalsSetPercentage}%)</span>
              </span>
            </div>
            <Progress
              value={data.goalsSetPercentage}
              className={`h-2 ${getProgressColorClass(data.goalsSetPercentage)}`}
            />
          </div>

          {/* Self-Assessment Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">自己評価</span>
              </div>
              <span className="text-muted-foreground">
                {data.selfAssessmentsCompletedCount}/{data.totalSubordinates}名
                <span className="ml-1 font-semibold">({data.selfAssessmentsCompletedPercentage}%)</span>
              </span>
            </div>
            <Progress
              value={data.selfAssessmentsCompletedPercentage}
              className={`h-2 ${getProgressColorClass(data.selfAssessmentsCompletedPercentage)}`}
            />
          </div>

          {/* Review/Feedback Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">評価完了</span>
              </div>
              <span className="text-muted-foreground">
                {data.reviewsCompletedCount}/{data.totalSubordinates}名
                <span className="ml-1 font-semibold">({data.reviewsCompletedPercentage}%)</span>
              </span>
            </div>
            <Progress
              value={data.reviewsCompletedPercentage}
              className={`h-2 ${getProgressColorClass(data.reviewsCompletedPercentage)}`}
            />
          </div>

          {/* Attention Needed */}
          {(data.needsAttentionCount > 0 || data.overdueCount > 0) && (
            <div className="pt-4 mt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">要対応</span>
                </div>
                <div className="flex items-center gap-2">
                  {data.needsAttentionCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      注意: {data.needsAttentionCount}名
                    </Badge>
                  )}
                  {data.overdueCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      遅延: {data.overdueCount}名
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

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
export function TeamProgressCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted animate-pulse rounded w-32" />
                <div className="h-4 bg-muted animate-pulse rounded w-24" />
              </div>
              <div className="h-2 bg-muted animate-pulse rounded w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}