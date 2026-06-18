"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { submitSupervisorFeedbackAction } from "@/api/server-actions/supervisor-feedbacks";
import { submitCoreValueFeedbackAction } from "@/api/server-actions/core-values";
import { flushSupervisorFeedbackAutoSaves, getSupervisorFeedbackSnapshot } from "../hooks/useSupervisorFeedbackAutoSave";
import { flushCoreValueFeedbackAutoSaves, getCoreValueFeedbackSnapshot } from "../hooks/useCoreValueFeedbackAutoSave";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useResponsiveBreakpoint } from "@/hooks/useResponsiveBreakpoint";
import { generateAccessibilityId, announceToScreenReader } from "@/utils/accessibility";
import type { CoreValueFeedback, CompetencyRatingData, RatingCode } from "@/api/types";
import type { PerformanceGoalSupervisorData } from "../display/PerformanceGoalsSupervisorEvaluation";
import type { CompetencySupervisorData } from "../display/CompetencySupervisorEvaluation";

interface SupervisorSubmitButtonProps {
  performanceGoals: PerformanceGoalSupervisorData[];
  competencyGoals: CompetencySupervisorData[];
  coreValueFeedback?: CoreValueFeedback | null;
  coreValueDefinitionsCount?: number;
  coreValueScores?: Record<string, string> | null;
  onSubmitSuccess?: () => void;
  disabled?: boolean;
}

/**
 * Check if a performance goal feedback can be submitted (has feedbackId and not already submitted)
 * Note: Rating and comment are OPTIONAL - supervisor can submit without filling them
 */
function canSubmitPerformanceFeedback(goal: PerformanceGoalSupervisorData): boolean {
  // Need feedbackId and not already submitted - rating/comment are optional
  return !!goal.feedbackId && goal.feedbackStatus !== 'submitted';
}

/**
 * Check if a competency goal feedback can be submitted (has feedbackId and not already submitted)
 * Note: Ratings and comment are OPTIONAL - supervisor can submit without filling them
 */
function canSubmitCompetencyFeedback(competency: CompetencySupervisorData): boolean {
  // Need feedbackId and not already submitted - ratings/comment are optional
  return !!competency.feedbackId && competency.feedbackStatus !== 'submitted';
}

/**
 * Whether the core value feedback is complete enough to submit: every active
 * definition scored AND a non-empty comment. Pure + exported so it can be unit
 * tested and reused. Callers should pass the LIVE on-screen values (snapshot),
 * falling back to the server-derived prop only when no card is mounted.
 */
export function isCoreValueFeedbackComplete(
  scores: Record<string, string> | null | undefined,
  comment: string | null | undefined,
  definitionsCount: number,
): boolean {
  if (definitionsCount === 0) return true;
  if (Object.keys(scores ?? {}).length < definitionsCount) return false;
  if (!comment?.trim()) return false;
  return true;
}

/** A single feedback's resolved submit payload fields. */
export interface ResolvedSubmitFields {
  supervisorRatingCode?: RatingCode;
  supervisorComment?: string;
  ratingData?: CompetencyRatingData;
}

/**
 * Resolve the values to submit for ONE feedback, applying WYSIWYS:
 * - If a live snapshot exists (card mounted), it is the source of truth —
 *   including `null` rating (intentional deselect), which maps to `undefined`
 *   because the submit API has no explicit "clear" (backend keeps the existing
 *   value when rating_code is omitted — pre-existing, flagged follow-up).
 * - Otherwise fall back to the server-derived prop values.
 *
 * Pure + exported for unit testing (project pattern: test the function).
 */
export function resolveSupervisorSubmitFields(
  snapshot: { supervisorRatingCode?: RatingCode | null; supervisorComment?: string; ratingData?: CompetencyRatingData } | undefined,
  prop: { supervisorRatingCode?: RatingCode | null; supervisorComment?: string },
  isCompetency: boolean,
): ResolvedSubmitFields {
  if (isCompetency) {
    // Competency rating lives in ratingData (per action), never a single code.
    return {
      supervisorRatingCode: undefined,
      supervisorComment: snapshot ? snapshot.supervisorComment : prop.supervisorComment,
      ratingData: snapshot ? snapshot.ratingData : undefined,
    };
  }
  const ratingCode = snapshot ? snapshot.supervisorRatingCode : prop.supervisorRatingCode;
  return {
    supervisorRatingCode: ratingCode ?? undefined,
    supervisorComment: snapshot ? snapshot.supervisorComment : prop.supervisorComment,
    ratingData: undefined,
  };
}

export default function SupervisorSubmitButton({
  performanceGoals,
  competencyGoals,
  coreValueFeedback,
  coreValueDefinitionsCount = 0,
  coreValueScores,
  onSubmitSuccess,
  disabled = false,
}: SupervisorSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Accessibility and responsive hooks
  const { containerRef } = useKeyboardNavigation({
    enableArrowKeys: true,
    enableTabNavigation: true,
    enableEscapeKey: true,
    onEscape: () => {
      if (!isSubmitting) {
        setIsOpen(false);
        announceToScreenReader('確認ダイアログがキャンセルされました', 'polite');
      }
    },
    onEnter: () => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement?.tagName === 'BUTTON') {
        activeElement.click();
      }
    }
  });
  const { isMobile } = useResponsiveBreakpoint();

  // Generate unique ID for content region
  const contentId = useMemo(() => generateAccessibilityId('supervisor-submit-dialog-content'), []);

  // Announce dialog opening to screen readers
  useEffect(() => {
    if (isOpen) {
      announceToScreenReader('評価提出確認ダイアログが開きました', 'polite');
    }
  }, [isOpen]);

  // Get feedbacks that can be submitted (have feedbackId)
  const submittablePerformanceGoals = performanceGoals.filter(canSubmitPerformanceFeedback);
  const submittableCompetencyGoals = competencyGoals.filter(canSubmitCompetencyFeedback);

  // Check if core value feedback can be submitted
  const canSubmitCoreValueFeedback = coreValueFeedback?.id && coreValueFeedback.status !== 'submitted';

  const hasSubmittableFeedbacks = submittablePerformanceGoals.length > 0 || submittableCompetencyGoals.length > 0 || !!canSubmitCoreValueFeedback;

  // Deduplicate competency goals by feedbackId (multiple competencies share the same feedback)
  const uniqueCompetencyFeedbacks = useMemo(() => {
    const seen = new Set<string>();
    return submittableCompetencyGoals.filter(c => {
      if (seen.has(c.feedbackId!)) return false;
      seen.add(c.feedbackId!);
      return true;
    });
  }, [submittableCompetencyGoals]);

  // WYSIWYS: read EXACTLY what the user currently sees from the live snapshot
  // registry (backed by a synchronously-updated ref in each mounted card),
  // falling back to the server-derived prop only when no card is mounted.
  // This eliminates the stale-prop bug where a fast 最終提出 click (before the
  // 2s debounced auto-save persisted) submitted the previous rating.
  const feedbacksToSubmit = [
    ...submittablePerformanceGoals.map(g => ({
      feedbackId: g.feedbackId!,
      ...resolveSupervisorSubmitFields(
        getSupervisorFeedbackSnapshot(g.feedbackId!),
        { supervisorRatingCode: g.supervisorRatingCode, supervisorComment: g.supervisorComment },
        false,
      ),
    })),
    ...uniqueCompetencyFeedbacks.map(c => ({
      feedbackId: c.feedbackId!,
      ...resolveSupervisorSubmitFields(
        getSupervisorFeedbackSnapshot(c.feedbackId!),
        { supervisorComment: c.supervisorComment },
        true,
      ),
    })),
  ];

  // Core value completeness check. Reads the LIVE on-screen values (WYSIWYS snapshot)
  // so a fast 最終提出 click — before the 2s debounced auto-save propagates back to the
  // parent's coreValueFeedback prop — is not falsely blocked as "未入力". Falls back to
  // the server-derived prop only when no card is mounted. Mirrors how performance/
  // competency use getSupervisorFeedbackSnapshot.
  const isCoreValueComplete = (() => {
    if (!canSubmitCoreValueFeedback || coreValueDefinitionsCount === 0) return true;
    const snapshot = coreValueFeedback?.id
      ? getCoreValueFeedbackSnapshot(coreValueFeedback.id)
      : undefined;
    const scores = snapshot ? snapshot.scores : coreValueScores;
    const comment = snapshot ? snapshot.comment : coreValueFeedback?.comment;
    return isCoreValueFeedbackComplete(scores, comment, coreValueDefinitionsCount);
  })();

  const hasIncomplete = !isCoreValueComplete;

  const totalToSubmit = feedbacksToSubmit.length + (canSubmitCoreValueFeedback ? 1 : 0);
  const canSubmit = totalToSubmit > 0 && !hasIncomplete;

  const handleCancel = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      announceToScreenReader('操作がキャンセルされました', 'polite');
    }
  };

  // Handle button click - flush pending auto-saves, then open dialog.
  // NOTE: we intentionally do NOT refresh from the server here. Refreshing
  // re-derived the cards from the (possibly not-yet-persisted) backend and
  // visually reverted the user's rating before submit. The submit now reads
  // the live local snapshot (WYSIWYS), so a pre-dialog refresh is unnecessary
  // and harmful. The post-submit refresh still happens via onSubmitSuccess.
  const handleButtonClick = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        flushSupervisorFeedbackAutoSaves(),
        flushCoreValueFeedbackAutoSaves(),
      ]);
    } finally {
      setIsRefreshing(false);
    }

    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (totalToSubmit === 0) return;

    announceToScreenReader('評価の提出処理を開始します', 'assertive');
    setIsSubmitting(true);

    try {
      // Submit all feedbacks with APPROVED action + core value feedback
      const submitPromises = [
        ...feedbacksToSubmit.map((feedback) =>
          submitSupervisorFeedbackAction(feedback.feedbackId, {
            action: 'APPROVED',
            supervisorRatingCode: feedback.supervisorRatingCode,
            supervisorComment: feedback.supervisorComment,
            ratingData: feedback.ratingData,
          })
        ),
        ...(canSubmitCoreValueFeedback && coreValueFeedback?.id
          ? [submitCoreValueFeedbackAction(coreValueFeedback.id, { action: 'APPROVED' })]
          : []),
      ];
      const results = await Promise.all(submitPromises);

      const failedCount = results.filter((r) => !r.success).length;
      const successCount = results.filter((r) => r.success).length;

      setIsOpen(false);

      if (failedCount === 0) {
        toast.success(`${successCount}件の評価を提出しました`, {
          description: '自己評価が承認されました。',
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

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={canSubmit ? "default" : "outline"}
        disabled={disabled || isSubmitting || isRefreshing || !hasSubmittableFeedbacks}
        onClick={handleButtonClick}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
        aria-label="評価を最終提出する"
      >
        {isSubmitting || isRefreshing ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{isRefreshing ? "確認中..." : "最終提出"}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          ref={containerRef as React.Ref<HTMLDivElement>}
          showCloseButton={false}
          className={`${isMobile ? 'mx-4 max-w-sm' : 'max-w-md'}`}
          onEscapeKeyDown={(e) => {
            if (isSubmitting) {
              e.preventDefault();
            } else {
              handleCancel();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hasIncomplete ? (
                <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5 text-blue-600" aria-hidden="true" />
              )}
              評価を提出しますか？
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              提出内容を確認してください。
            </DialogDescription>
          </DialogHeader>
          <div
            id={contentId}
            className={`space-y-3 ${isMobile ? 'px-4 pb-3' : 'px-6 pb-4'}`}
            role="region"
            aria-label="確認内容"
          >
            {hasIncomplete ? (
              <div
                className="p-3 rounded-md border-l-4 bg-amber-50 border-amber-500"
                role="alert"
                aria-live="polite"
              >
                <p className="text-sm font-medium text-amber-700">
                  以下の項目が未入力です：
                </p>
                <ul className="list-disc list-inside text-sm text-amber-700 mt-2">
                  <li>コアバリュー: 全項目の評価とコメントが必要です</li>
                </ul>
                <p className="text-sm mt-2 text-amber-700">
                  すべての項目を入力してから提出してください。
                </p>
              </div>
            ) : (
              <>
                <div
                  className="p-3 rounded-md border-l-4 bg-muted/50 border-blue-500"
                  role="region"
                  aria-label="提出情報"
                >
                  <p className="text-sm font-medium text-foreground">
                    提出対象: {totalToSubmit}件の評価
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ※ コアバリュー評価は全項目必須です（業績目標・コンピテンシーの評点・コメントは任意）
                  </p>
                </div>
                <div
                  className="p-3 rounded-md border-l-4 bg-green-50 border-green-500"
                  role="region"
                  aria-label="補足情報"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        提出すると自己評価が承認されます
                      </p>
                      <p className="text-sm mt-1 text-green-600">
                        承認後は部下の自己評価が確定され、編集できなくなります。
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className={`focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all ${isMobile ? 'w-full h-12 text-base touch-manipulation' : ''}`}
              aria-label="操作をキャンセルしてダイアログを閉じます"
              tabIndex={0}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all ${isMobile ? 'w-full h-12 text-base touch-manipulation' : ''}`}
              aria-label={canSubmit ? '評価を提出して自己評価を承認します。' : '未評価の項目があるため提出できません'}
              tabIndex={0}
            >
              {isSubmitting ? (
                <>
                  <div
                    className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                    aria-hidden="true"
                  />
                  <span aria-live="polite">提出中...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                  提出する
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
