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
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { submitSupervisorFeedbackAction } from "@/api/server-actions/supervisor-feedbacks";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useResponsiveBreakpoint } from "@/hooks/useResponsiveBreakpoint";
import { generateAccessibilityId, announceToScreenReader } from "@/utils/accessibility";
import type { PerformanceGoalSupervisorData } from "../display/PerformanceGoalsSupervisorEvaluation";
import type { CompetencySupervisorData } from "../display/CompetencySupervisorEvaluation";

interface SupervisorSubmitButtonProps {
  performanceGoals: PerformanceGoalSupervisorData[];
  competencyGoals: CompetencySupervisorData[];
  onSubmitSuccess?: () => void;
  /** Called before opening dialog to refresh data for accurate validation */
  onRefreshData?: () => Promise<void>;
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

export default function SupervisorSubmitButton({
  performanceGoals,
  competencyGoals,
  onSubmitSuccess,
  onRefreshData,
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

  const hasSubmittableFeedbacks = submittablePerformanceGoals.length > 0 || submittableCompetencyGoals.length > 0;

  // Deduplicate competency goals by feedbackId (multiple competencies share the same feedback)
  const uniqueCompetencyFeedbacks = useMemo(() => {
    const seen = new Set<string>();
    return submittableCompetencyGoals.filter(c => {
      if (seen.has(c.feedbackId!)) return false;
      seen.add(c.feedbackId!);
      return true;
    });
  }, [submittableCompetencyGoals]);

  // All feedbacks with feedbackId can be submitted (rating/comment are optional)
  const feedbacksToSubmit = [
    ...submittablePerformanceGoals.map(g => ({
      feedbackId: g.feedbackId!,
      supervisorRatingCode: g.supervisorRatingCode, // Optional
      supervisorComment: g.supervisorComment, // Optional
    })),
    ...uniqueCompetencyFeedbacks.map(c => ({
      feedbackId: c.feedbackId!,
      // For competency, we don't have a single rating code
      // The rating is stored in ratingData per action
      supervisorRatingCode: undefined,
      supervisorComment: c.supervisorComment, // Optional
    })),
  ];

  const canSubmit = feedbacksToSubmit.length > 0;

  const handleCancel = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      announceToScreenReader('操作がキャンセルされました', 'polite');
    }
  };

  // Handle button click - refresh data first, then open dialog
  const handleButtonClick = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      try {
        await onRefreshData();
      } finally {
        setIsRefreshing(false);
      }
    }
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (feedbacksToSubmit.length === 0) return;

    announceToScreenReader('評価の提出処理を開始します', 'assertive');
    setIsSubmitting(true);

    try {
      // Submit all feedbacks with APPROVED action
      const results = await Promise.all(
        feedbacksToSubmit.map((feedback) =>
          submitSupervisorFeedbackAction(feedback.feedbackId, {
            action: 'APPROVED',
            supervisorRatingCode: feedback.supervisorRatingCode,
            supervisorComment: feedback.supervisorComment,
          })
        )
      );

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
              <Send className="h-5 w-5 text-blue-600" aria-hidden="true" />
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
            <div
              className="p-3 rounded-md border-l-4 bg-muted/50 border-blue-500"
              role="region"
              aria-label="提出情報"
            >
              <p className="text-sm font-medium text-foreground">
                提出対象: {feedbacksToSubmit.length}件の評価
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ※ 上長評価（評点・コメント）は任意です
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
