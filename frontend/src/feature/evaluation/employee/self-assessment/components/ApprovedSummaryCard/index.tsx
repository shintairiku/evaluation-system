'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, TrendingUp, Flag } from 'lucide-react';
import type { SelfAssessmentSummary } from '@/api/types';
import { formatAssessmentDate } from '@/lib/date-utils';

interface ApprovedSummaryCardProps {
  summary: SelfAssessmentSummary;
}

export function ApprovedSummaryCard({ summary }: ApprovedSummaryCardProps) {

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            承認済み
          </CardTitle>
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
            確定
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Rating Display */}
        <div className="bg-white rounded-lg p-3 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">最終評価</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">{summary.finalRating}</span>
              <span className="text-sm text-muted-foreground">
                ({summary.weightedTotal.toFixed(2)} pt)
              </span>
            </div>
          </div>
        </div>

        {/* Bucket Breakdown */}
        {summary.perBucket && summary.perBucket.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {(() => {
              const buckets = summary.perBucket;
              const quantBucket = buckets.find(b => b.bucket === 'quantitative');
              const qualBucket = buckets.find(b => b.bucket === 'qualitative');
              const compBucket = buckets.find(b => b.bucket === 'competency');

              const displayBuckets = [];

              // Combine quantitative + qualitative into performance
              if (quantBucket || qualBucket) {
                const totalWeight = (quantBucket?.weight || 0) + (qualBucket?.weight || 0);
                const totalContribution = (quantBucket?.contribution || 0) + (qualBucket?.contribution || 0);

                displayBuckets.push(
                  <div key="performance" className="rounded-lg border border-green-200 bg-white p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">目標達成（定量＋定性）</span>
                      <span className="text-xs text-muted-foreground">{totalWeight.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-green-600">{summary.finalRating}</span>
                      <span className="text-xs text-muted-foreground">
                        {totalContribution.toFixed(2)} pt
                      </span>
                    </div>
                  </div>
                );
              }

              // Competency bucket
              if (compBucket) {
                displayBuckets.push(
                  <div key="competency" className="rounded-lg border border-green-200 bg-white p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">コンピテンシー</span>
                      <span className="text-xs text-muted-foreground">{compBucket.weight.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-green-600">{summary.finalRating}</span>
                      <span className="text-xs text-muted-foreground">
                        {compBucket.contribution.toFixed(2)} pt
                      </span>
                    </div>
                  </div>
                );
              }

              return displayBuckets;
            })()}
          </div>
        )}

        {/* Level Adjustment Preview */}
        {summary.levelAdjustmentPreview && (
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <div className="flex items-center gap-2 mb-1.5">
              <Flag className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">レベル調整</span>
            </div>
            <div className="flex items-baseline gap-2">
              {summary.levelAdjustmentPreview.rating && (
                <span className="text-base font-semibold text-green-600">
                  {summary.levelAdjustmentPreview.rating}
                </span>
              )}
              {summary.levelAdjustmentPreview.delta !== undefined && (
                <span className={`text-xs font-medium ${summary.levelAdjustmentPreview.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ({summary.levelAdjustmentPreview.delta >= 0 ? '+' : ''}{summary.levelAdjustmentPreview.delta.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Submission Date */}
        {summary.submittedAt && (
          <div className="pt-2 border-t border-green-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">承認日時</span>
              <span className="font-medium text-gray-700">{formatAssessmentDate(summary.submittedAt)}</span>
            </div>
          </div>
        )}

        {/* Success Message */}
        <div className="bg-green-100 rounded-lg p-3 mt-3">
          <p className="text-sm text-green-700 text-center font-medium">
            自己評価が承認されました。お疲れ様でした。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
