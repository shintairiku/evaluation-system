'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History,
  Target,
  FileText,
  MessageSquare,
  Calendar,
  ArrowRight,
  FolderOpen
} from 'lucide-react';

import type { HistoryAccessData, HistoricalPeriodSummary } from '@/api/types';

export interface HistoryAccessCardProps {
  data: HistoryAccessData;
  isLoading?: boolean;
  className?: string;
  onPeriodClick?: (period: HistoricalPeriodSummary) => void;
}

/**
 * HistoryAccessCard component for accessing historical evaluation data
 *
 * Displays:
 * - Recent evaluation periods with summary
 * - Quick access links to historical goals, assessments, and feedback
 * - Period statistics (goals count, assessments count, feedback count)
 */
export default function HistoryAccessCard({
  data,
  isLoading = false,
  className = '',
  onPeriodClick
}: HistoryAccessCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            評価履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <div className="h-4 bg-muted animate-pulse rounded w-48 mb-2" />
                <div className="h-3 bg-muted animate-pulse rounded w-32 mb-3" />
                <div className="flex gap-2">
                  <div className="h-8 bg-muted animate-pulse rounded flex-1" />
                  <div className="h-8 bg-muted animate-pulse rounded flex-1" />
                  <div className="h-8 bg-muted animate-pulse rounded flex-1" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no historical data
  if (!data.hasHistoricalData || data.recentPeriods.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            評価履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              履歴データがありません
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              過去の評価期間が表示されます
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            評価履歴
          </div>
          <Badge variant="secondary" className="text-xs">
            {data.totalPeriods}期間
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.recentPeriods.slice(0, 3).map((period) => (
            <div
              key={period.periodId}
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{period.periodName}</span>
                    <Badge variant="outline" className="text-xs">
                      {period.periodType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    終了日: {new Date(period.endDate).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="flex flex-col items-center p-2 bg-blue-50 rounded border border-blue-100">
                  <Target className="w-4 h-4 text-blue-600 mb-1" />
                  <span className="text-xs text-muted-foreground">目標</span>
                  <span className="text-sm font-semibold">{period.goalsCount}件</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-green-50 rounded border border-green-100">
                  <FileText className="w-4 h-4 text-green-600 mb-1" />
                  <span className="text-xs text-muted-foreground">評価</span>
                  <span className="text-sm font-semibold">{period.completedAssessmentsCount}件</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-purple-50 rounded border border-purple-100">
                  <MessageSquare className="w-4 h-4 text-purple-600 mb-1" />
                  <span className="text-xs text-muted-foreground">FB</span>
                  <span className="text-sm font-semibold">{period.receivedFeedbacksCount}件</span>
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Link href={`/(evaluation)/(employee)/goals?period=${period.periodId}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => onPeriodClick?.(period)}
                  >
                    <Target className="w-3 h-3 mr-1" />
                    目標
                  </Button>
                </Link>
                <Link href={`/(evaluation)/(employee)/self-assessments?period=${period.periodId}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => onPeriodClick?.(period)}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    評価
                  </Button>
                </Link>
                <Link href={`/(evaluation)/(employee)/feedbacks?period=${period.periodId}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => onPeriodClick?.(period)}
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    FB
                  </Button>
                </Link>
              </div>
            </div>
          ))}

          {/* View all link */}
          {data.totalPeriods > 3 && (
            <Link href="/(evaluation)/(employee)/history">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                すべての履歴を表示
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton component for loading state
 */
export function HistoryAccessCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-5 h-5 bg-muted animate-pulse rounded" />
          <div className="h-5 bg-muted animate-pulse rounded w-24" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <div className="h-4 bg-muted animate-pulse rounded w-48 mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-32 mb-3" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 bg-muted animate-pulse rounded" />
                <div className="h-8 bg-muted animate-pulse rounded" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}