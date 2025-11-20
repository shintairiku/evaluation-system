'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp } from 'lucide-react';
import type { SelfAssessmentDraftEntry } from '@/api/types';

interface PendingReviewCardProps {
  entries: SelfAssessmentDraftEntry[];
  submittedAt?: string;
  finalRating?: string;
  weightedTotal?: number;
}

export function PendingReviewCard({
  entries,
  submittedAt,
  finalRating,
  weightedTotal
}: PendingReviewCardProps) {
  // Calculate bucket totals
  const bucketTotals = React.useMemo(() => {
    const totals: Record<string, { count: number; avgRating?: string }> = {};

    entries.forEach(entry => {
      if (!totals[entry.bucket]) {
        totals[entry.bucket] = { count: 0 };
      }
      totals[entry.bucket].count += 1;
      // Store rating if available
      if (entry.ratingCode) {
        totals[entry.bucket].avgRating = entry.ratingCode;
      }
    });

    return totals;
  }, [entries]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            審査待ち
          </CardTitle>
          <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
            提出済み
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Rating Display */}
        {finalRating && (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">自己評価結果</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-700">{finalRating}</span>
                {weightedTotal !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    ({weightedTotal.toFixed(2)} pt)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bucket Breakdown */}
        <div className="grid gap-2 md:grid-cols-2">
          {Object.entries(bucketTotals).map(([bucket, data]) => {
            const bucketLabels: Record<string, string> = {
              quantitative: '定量目標',
              qualitative: '定性目標',
              competency: 'コンピテンシー'
            };

            return (
              <div key={bucket} className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {bucketLabels[bucket] || bucket}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {data.count}件
                  </span>
                </div>
                {data.avgRating && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-gray-600">
                      {data.avgRating}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submission Info */}
        {submittedAt && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">提出日時</span>
              <span className="font-medium text-gray-700">{formatDate(submittedAt)}</span>
            </div>
          </div>
        )}

        {/* Status Message */}
        <div className="bg-gray-100 rounded-lg p-3 mt-3">
          <p className="text-sm text-gray-600 text-center">
            上司による審査を待っています。承認または差し戻しの通知をお待ちください。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
