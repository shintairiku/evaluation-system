'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { EmployeeInfoCard } from '@/components/evaluation/EmployeeInfoCard';
import { CoreValueScoreGrid } from './CoreValueScoreGrid';
import { OverallRatingSummary } from './OverallRatingSummary';
import { EvaluationCommentsSection } from './EvaluationCommentsSection';
import { getEvaluationDetailAction } from '@/api/server-actions/peer-reviews';
import { getUserByIdAction } from '@/api/server-actions/users/queries';
import type { EvaluationDetailResponse, UserDetailResponse } from '@/api/types';

interface EvaluationDetailSheetProps {
  open: boolean;
  onClose: () => void;
  periodId: string;
  userId: string;
}

export function EvaluationDetailSheet({
  open,
  onClose,
  periodId,
  userId,
}: EvaluationDetailSheetProps) {
  const [detail, setDetail] = useState<EvaluationDetailResponse | null>(null);
  const [user, setUser] = useState<UserDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !periodId || !userId) return;

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);
      setDetail(null);
      setUser(null);

      try {
        const [detailResult, userResult] = await Promise.all([
          getEvaluationDetailAction(periodId, userId),
          getUserByIdAction(userId),
        ]);

        if (cancelled) return;

        if (!detailResult.success || !detailResult.data) {
          setError(detailResult.error || '評価詳細の取得に失敗しました');
          return;
        }

        setDetail(detailResult.data);

        if (userResult.success && userResult.data) {
          setUser(userResult.data);
        }
      } catch {
        if (!cancelled) {
          setError('予期しないエラーが発生しました');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [open, periodId, userId]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>評価詳細</DialogTitle>
          <DialogDescription>
            {detail ? `${detail.userName} - ${detail.periodName || ''}` : '読み込み中...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!isLoading && !error && detail && (
            <>
              {user && <EmployeeInfoCard employee={user} />}

              <CoreValueScoreGrid coreValues={detail.coreValues} />

              <OverallRatingSummary
                selfAvgRating={detail.selfAvgRating}
                peer1AvgRating={detail.peer1AvgRating}
                peer2AvgRating={detail.peer2AvgRating}
                supervisorAvgRating={detail.supervisorAvgRating}
                overallRating={detail.overallRating}
              />

              <EvaluationCommentsSection comments={detail.comments} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
