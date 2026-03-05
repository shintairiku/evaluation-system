'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PeerReviewEvaluation, CoreValueDefinition } from '@/api/types';
import { submitPeerReviewEvaluationAction } from '@/api/server-actions/peer-reviews';
import { flushPeerReviewAutoSaves } from '../hooks/usePeerReviewAutoSave';

interface PeerReviewSubmitButtonProps {
  evaluations: PeerReviewEvaluation[];
  definitions: CoreValueDefinition[];
  onSubmitSuccess?: () => void;
  onRefreshData?: () => Promise<void>;
  disabled?: boolean;
}

/**
 * Check if a single peer review evaluation is complete
 */
function isEvaluationComplete(
  evaluation: PeerReviewEvaluation,
  definitionCount: number,
): boolean {
  if (evaluation.status === 'submitted') return true;

  const scores = evaluation.scores ?? {};
  const allScored = Object.keys(scores).length >= definitionCount;
  const hasComment = !!evaluation.comment?.trim();
  return allScored && hasComment;
}

export default function PeerReviewSubmitButton({
  evaluations,
  definitions,
  onSubmitSuccess,
  onRefreshData,
  disabled = false,
}: PeerReviewSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  const definitionCount = definitions.length;

  // Categorize evaluations
  const draftEvaluations = evaluations.filter((e) => e.status === 'draft');
  const submittedEvaluations = evaluations.filter((e) => e.status === 'submitted');

  const completeDrafts = draftEvaluations.filter((e) =>
    isEvaluationComplete(e, definitionCount)
  );
  const incompleteDrafts = draftEvaluations.filter(
    (e) => !isEvaluationComplete(e, definitionCount)
  );

  const allAlreadySubmitted =
    evaluations.length > 0 && draftEvaluations.length === 0;
  const hasIncomplete = incompleteDrafts.length > 0;
  const totalToSubmit = completeDrafts.length;
  const canSubmit = totalToSubmit > 0 && !hasIncomplete;
  const hasEditableEvaluations = draftEvaluations.length > 0;

  // Handle button click - flush auto-saves then open dialog
  const handleButtonClick = async () => {
    setIsFlushing(true);
    try {
      await flushPeerReviewAutoSaves();
      if (onRefreshData) {
        await onRefreshData();
      }
    } finally {
      setIsFlushing(false);
    }
    setIsOpen(true);
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setIsOpen(false);
    }
  };

  const handleSubmit = async () => {
    if (totalToSubmit === 0) return;

    setIsSubmitting(true);
    try {
      const results = await Promise.all(
        completeDrafts.map((e) => submitPeerReviewEvaluationAction(e.id))
      );

      const failedCount = results.filter((r) => !r.success).length;
      const successCount = results.filter((r) => r.success).length;

      setIsOpen(false);

      if (failedCount === 0) {
        toast.success(`${successCount}件の同僚評価を提出しました`, {
          description: '提出ありがとうございます。',
        });
        onSubmitSuccess?.();
      } else if (successCount > 0) {
        toast.error(`${successCount}件成功、${failedCount}件失敗しました`, {
          description: '失敗した項目は再度お試しください。',
        });
        onSubmitSuccess?.();
      } else {
        toast.error('提出に失敗しました', {
          description: 'もう一度お試しください。',
        });
      }
    } catch {
      setIsOpen(false);
      toast.error('予期せぬエラーが発生しました', {
        description: 'しばらく時間をおいて再度お試しください。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build validation messages
  const getValidationMessages = (): string[] => {
    return incompleteDrafts.map((e) => {
      const name = e.revieweeName ?? '不明';
      const scores = e.scores ?? {};
      const allScored = Object.keys(scores).length >= definitionCount;
      const hasComment = !!e.comment?.trim();

      if (!allScored && !hasComment) {
        return `${name}：評価とコメントが未入力`;
      } else if (!allScored) {
        return `${name}：評価が未入力`;
      } else {
        return `${name}：コメントが未入力`;
      }
    });
  };

  const validationMessages = getValidationMessages();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={canSubmit ? 'default' : 'outline'}
        disabled={disabled || isSubmitting || isFlushing || !hasEditableEvaluations}
        onClick={handleButtonClick}
        className="flex items-center space-x-2"
      >
        {isSubmitting || isFlushing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        <span>{isFlushing ? '確認中...' : '提出する'}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hasIncomplete ? (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              ) : allAlreadySubmitted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <Send className="h-5 w-5 text-blue-600" />
              )}
              {allAlreadySubmitted ? '提出状況' : '同僚評価を提出しますか？'}
            </DialogTitle>
            <DialogDescription>
              {allAlreadySubmitted
                ? '現在の提出状況を確認してください。'
                : '提出内容を確認してください。'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 pb-4">
            {hasIncomplete ? (
              <div className="p-3 rounded-md border-l-4 bg-amber-50 border-amber-500">
                <p className="text-sm font-medium text-amber-700">
                  以下の項目が未入力です：
                </p>
                <ul className="list-disc list-inside text-sm text-amber-700 mt-2">
                  {validationMessages.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
                <p className="text-sm mt-2 text-amber-700">
                  すべての項目を入力してから提出してください。
                </p>
              </div>
            ) : allAlreadySubmitted ? (
              <div className="p-3 rounded-md border-l-4 bg-green-50 border-green-500">
                <p className="text-sm font-medium text-green-700">
                  すべての同僚評価は提出済みです
                </p>
                <p className="text-sm mt-1 text-green-700">
                  提出済み: {submittedEvaluations.length}件
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-md border-l-4 bg-muted/50 border-blue-500">
                <p className="text-sm font-medium text-foreground">
                  提出対象: {totalToSubmit}件の同僚評価
                </p>
                <p className="text-sm mt-1">
                  提出後は変更できません。内容をご確認ください。
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {allAlreadySubmitted ? '閉じる' : 'キャンセル'}
            </Button>
            {!allAlreadySubmitted && (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    提出中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    提出する
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
