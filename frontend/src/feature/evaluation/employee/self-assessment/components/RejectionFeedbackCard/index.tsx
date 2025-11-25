'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, MessageSquare, TrendingUp } from 'lucide-react';
import type { SelfAssessmentDraftEntry } from '@/api/types';
import { BUCKET_LABELS } from '../../constants';
import { formatAssessmentDate } from '@/lib/date-utils';

interface RejectionFeedbackCardProps {
  entries: SelfAssessmentDraftEntry[];
  rejectedAt?: string;
}

export function RejectionFeedbackCard({
  entries,
  rejectedAt
}: RejectionFeedbackCardProps) {
  // Group entries by bucket and extract supervisor feedback
  const bucketFeedback = React.useMemo(() => {
    const feedback: Record<string, {
      count: number;
      employeeRating?: string;
      supervisorComment?: string;
      supervisorRating?: string;
    }> = {};

    entries.forEach(entry => {
      if (!feedback[entry.bucket]) {
        feedback[entry.bucket] = { count: 0 };
      }
      feedback[entry.bucket].count += 1;

      // Store employee rating
      if (entry.ratingCode) {
        feedback[entry.bucket].employeeRating = entry.ratingCode;
      }

      // Store supervisor feedback
      if (entry.supervisorComment) {
        feedback[entry.bucket].supervisorComment = entry.supervisorComment;
      }

      // Store supervisor rating
      if (entry.supervisorRating) {
        feedback[entry.bucket].supervisorRating = entry.supervisorRating;
      }
    });

    return feedback;
  }, [entries]);

  // Check if there are any supervisor comments or ratings
  const hasSupervisorFeedback = React.useMemo(() => {
    return entries.some(entry => entry.supervisorComment || entry.supervisorRating);
  }, [entries]);

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            差し戻し
          </CardTitle>
          <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
            要再提出
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Alert Message */}
        <Alert className="bg-orange-100 border-orange-300">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-800">
            上司より差し戻しがありました。フィードバックを確認の上、修正して再提出してください。
          </AlertDescription>
        </Alert>

        {/* Supervisor Feedback by Bucket */}
        {hasSupervisorFeedback && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">上司からのフィードバック</span>
            </div>

            {Object.entries(bucketFeedback).map(([bucket, data]) => {
              // Show bucket if there's either a comment OR a rating
              if (!data.supervisorComment && !data.supervisorRating) return null;

              return (
                <div key={bucket} className="bg-white rounded-lg border border-orange-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      {BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS] || bucket}
                    </span>
                    <div className="flex items-center gap-2">
                      {data.employeeRating && (
                        <>
                          <span className="text-xs text-muted-foreground">あなた:</span>
                          <Badge variant="outline" className="text-xs">
                            {data.employeeRating}
                          </Badge>
                        </>
                      )}
                      {data.supervisorRating && (
                        <>
                          <span className="text-xs text-muted-foreground ml-2">推奨:</span>
                          <Badge variant="default" className="text-xs bg-orange-600">
                            {data.supervisorRating}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {data.supervisorComment && (
                    <div className="bg-orange-50 rounded p-2.5">
                      <p className="text-sm font-medium text-gray-600 mb-1">上司からのコメント:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {data.supervisorComment}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bucket Summary (if no supervisor comments) */}
        {!hasSupervisorFeedback && (
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(bucketFeedback).map(([bucket, data]) => (
              <div key={bucket} className="rounded-lg border border-orange-200 bg-white p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS] || bucket}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {data.count}件
                  </span>
                </div>
                {data.employeeRating && (
                  <div className="flex items-baseline gap-2">
                    <TrendingUp className="h-3 w-3 text-orange-500" />
                    <span className="text-sm font-semibold text-gray-600">
                      {data.employeeRating}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rejection Date */}
        {rejectedAt && (
          <div className="pt-2 border-t border-orange-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">差し戻し日時</span>
              <span className="font-medium text-gray-700">{formatAssessmentDate(rejectedAt)}</span>
            </div>
          </div>
        )}

        {/* Action Message */}
        <div className="bg-orange-100 rounded-lg p-3 mt-3">
          <p className="text-sm text-orange-700 text-center font-medium">
            修正が完了したら、再度提出してください。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
