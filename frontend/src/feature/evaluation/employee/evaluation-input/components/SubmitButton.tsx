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
import { Send, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { submitSelfAssessmentAction } from "@/api/server-actions/self-assessments";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useResponsiveBreakpoint } from "@/hooks/useResponsiveBreakpoint";
import { generateAccessibilityId, announceToScreenReader } from "@/utils/accessibility";
import type { CompetencyRatingData } from "@/api/types";
import type { GoalWithAssessment } from "../display/index";

interface SubmitButtonProps {
  performanceGoals: GoalWithAssessment[];
  competencyGoals: GoalWithAssessment[];
  onSubmitSuccess?: () => void;
  /** Called before opening dialog to refresh data for accurate validation */
  onRefreshData?: () => Promise<void>;
  disabled?: boolean;
}

/**
 * Check if a performance goal assessment is complete
 */
function isPerformanceAssessmentComplete(item: GoalWithAssessment): boolean {
  const assessment = item.selfAssessment;
  if (!assessment) return false;
  if (assessment.status !== 'draft') return false; // Already submitted

  return !!(assessment.selfRatingCode && assessment.selfComment?.trim());
}

/**
 * Check if a competency goal assessment is complete
 */
function isCompetencyAssessmentComplete(item: GoalWithAssessment): boolean {
  const assessment = item.selfAssessment;
  if (!assessment) return false;
  if (assessment.status !== 'draft') return false; // Already submitted

  // Must have comment
  if (!assessment.selfComment?.trim()) return false;

  // Must have all action ratings
  const ratingData = assessment.ratingData as CompetencyRatingData | undefined;
  if (!ratingData) return false;

  const selectedActions = item.goal.selectedIdealActions || {};

  // Check each competency has all actions rated
  for (const [competencyId, actionIndexes] of Object.entries(selectedActions)) {
    const competencyRatings = ratingData[competencyId];
    if (!competencyRatings) return false;

    for (const actionIdx of actionIndexes) {
      if (!competencyRatings[actionIdx]) return false;
    }
  }

  return true;
}

export default function SubmitButton({
  performanceGoals,
  competencyGoals,
  onSubmitSuccess,
  onRefreshData,
  disabled = false,
}: SubmitButtonProps) {
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
  const contentId = useMemo(() => generateAccessibilityId('submit-dialog-content'), []);

  // Announce dialog opening to screen readers
  useEffect(() => {
    if (isOpen) {
      announceToScreenReader('自己評価提出確認ダイアログが開きました', 'polite');
    }
  }, [isOpen]);

  // Get all draft assessments that need to be submitted
  const draftPerformanceAssessments = performanceGoals.filter(
    (item) => item.selfAssessment?.status === 'draft'
  );
  const draftCompetencyAssessments = competencyGoals.filter(
    (item) => item.selfAssessment?.status === 'draft'
  );

  // Check completion status
  const incompletePerformance = draftPerformanceAssessments.filter(
    (item) => !isPerformanceAssessmentComplete(item)
  );
  const incompleteCompetency = draftCompetencyAssessments.filter(
    (item) => !isCompetencyAssessmentComplete(item)
  );

  const hasIncomplete = incompletePerformance.length > 0 || incompleteCompetency.length > 0;
  const hasDraftAssessments = draftPerformanceAssessments.length > 0 || draftCompetencyAssessments.length > 0;

  // Get IDs of assessments to submit
  const assessmentIdsToSubmit = [
    ...draftPerformanceAssessments
      .filter((item) => isPerformanceAssessmentComplete(item))
      .map((item) => item.selfAssessment!.id),
    ...draftCompetencyAssessments
      .filter((item) => isCompetencyAssessmentComplete(item))
      .map((item) => item.selfAssessment!.id),
  ];

  const canSubmit = assessmentIdsToSubmit.length > 0 && !hasIncomplete;

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
    if (assessmentIdsToSubmit.length === 0) return;

    announceToScreenReader('自己評価の提出処理を開始します', 'assertive');
    setIsSubmitting(true);

    try {
      // Submit all assessments
      const results = await Promise.all(
        assessmentIdsToSubmit.map((id) => submitSelfAssessmentAction(id))
      );

      const failedCount = results.filter((r) => !r.success).length;
      const successCount = results.filter((r) => r.success).length;

      setIsOpen(false);

      if (failedCount === 0) {
        toast.success(`${successCount}件の自己評価を提出しました`, {
          description: '上司による確認をお待ちください。',
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
    } catch (error) {
      console.error('Submit error:', error);
      setIsOpen(false);
      toast.error('予期せぬエラーが発生しました', {
        description: 'しばらく時間をおいて再度お試しください。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build validation message
  const getValidationMessage = () => {
    const messages: string[] = [];

    if (incompletePerformance.length > 0) {
      messages.push(`業績目標: ${incompletePerformance.length}件が未入力`);
    }
    if (incompleteCompetency.length > 0) {
      messages.push(`コンピテンシー: ${incompleteCompetency.length}件が未入力`);
    }

    return messages;
  };

  const validationMessages = getValidationMessage();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={canSubmit ? "default" : "outline"}
        disabled={disabled || isSubmitting || isRefreshing || !hasDraftAssessments}
        onClick={handleButtonClick}
        className="flex items-center space-x-2"
        aria-label="自己評価を最終提出する"
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
              自己評価を提出しますか？
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
                  {validationMessages.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
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
                    提出対象: {assessmentIdsToSubmit.length}件の自己評価
                  </p>
                </div>
                <div
                  className="p-3 rounded-md border-l-4 bg-muted/50 border-amber-500"
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-sm font-medium text-amber-700">
                    重要な注意事項:
                  </p>
                  <p className="text-sm mt-1">
                    提出後は内容を変更できません。
                    上司による確認が完了するまでお待ちください。
                  </p>
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
              aria-label={canSubmit ? '自己評価を提出します。この操作は取り消すことができません。' : '未入力の項目があるため提出できません'}
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
