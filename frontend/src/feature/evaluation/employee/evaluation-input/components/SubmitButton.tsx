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
import { Send, Loader2, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { submitSelfAssessmentAction, reopenSelfAssessmentAction } from "@/api/server-actions/self-assessments";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useResponsiveBreakpoint } from "@/hooks/useResponsiveBreakpoint";
import { generateAccessibilityId, announceToScreenReader } from "@/utils/accessibility";
import { flushSelfAssessmentAutoSaves } from "../hooks/useSelfAssessmentAutoSave";
import type { CompetencyRatingData } from "@/api/types";
import type { GoalWithAssessment } from "../display/index";

interface SubmitButtonProps {
  performanceGoals: GoalWithAssessment[];
  competencyGoals: GoalWithAssessment[];
  onSubmitSuccess?: () => void;
  /** Called before opening dialog to refresh data for accurate validation */
  onRefreshData?: () => Promise<void>;
  /** Period-level editability (completed/cancelled periods are read-only) */
  isPeriodEditable?: boolean;
  disabled?: boolean;
}

function normalizeActionIndexes(actionIndexes: Array<string | number>): string[] {
  const unique = Array.from(
    new Set(
      actionIndexes
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
    )
  );

  return unique.sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    const aIsNumeric = Number.isFinite(aNum);
    const bIsNumeric = Number.isFinite(bNum);

    if (aIsNumeric && bIsNumeric) {
      return aNum - bNum;
    }

    return a.localeCompare(b);
  });
}

function getRequiredCompetencyActions(item: GoalWithAssessment): Record<string, string[]> {
  const goal = item.goal;
  const stageActionTexts = goal.allStageIdealActionTexts;
  const requiredFromStage = Object.entries(stageActionTexts || {}).reduce<Record<string, string[]>>(
    (acc, [competencyId, actionTexts]) => {
      if (Array.isArray(actionTexts)) {
        const indexes = normalizeActionIndexes(actionTexts.map((_, index) => String(index)));
        if (indexes.length > 0) {
          acc[competencyId] = indexes;
        }
        return acc;
      }

      if (actionTexts && typeof actionTexts === "object") {
        const indexes = normalizeActionIndexes(Object.keys(actionTexts));
        if (indexes.length > 0) {
          acc[competencyId] = indexes;
        }
      }

      return acc;
    },
    {}
  );

  if (Object.keys(requiredFromStage).length > 0) {
    return requiredFromStage;
  }

  const selectedIdealActions = goal.selectedIdealActions || {};
  return Object.entries(selectedIdealActions).reduce<Record<string, string[]>>(
    (acc, [competencyId, actionIndexes]) => {
      if (!Array.isArray(actionIndexes)) {
        return acc;
      }

      const normalized = normalizeActionIndexes(actionIndexes);
      if (normalized.length > 0) {
        acc[competencyId] = normalized;
      }
      return acc;
    },
    {}
  );
}

function hasRatingValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function hasAnyCompetencyRating(ratingData?: CompetencyRatingData): boolean {
  if (!ratingData) return false;

  return Object.values(ratingData).some((ratingsByAction) =>
    Object.values(ratingsByAction || {}).some(hasRatingValue)
  );
}

/**
 * Check if a performance goal assessment is complete
 */
function isPerformanceAssessmentComplete(item: GoalWithAssessment): boolean {
  const assessment = item.selfAssessment;
  if (!assessment) return false;
  // Approved assessments are locked and complete
  if (assessment.status === 'approved') return true;

  return !!(assessment.selfRatingCode && assessment.selfComment?.trim());
}

/**
 * Check if a competency goal assessment is complete.
 * Requires comment + at least one action rating.
 */
function isCompetencyAssessmentComplete(item: GoalWithAssessment): boolean {
  const assessment = item.selfAssessment;
  if (!assessment) return false;
  // Approved assessments are locked and complete
  if (assessment.status === 'approved') return true;

  // Comment is required
  if (!assessment.selfComment?.trim()) return false;

  // Rating data is required
  const ratingData = assessment.ratingData as CompetencyRatingData | undefined;
  if (!hasAnyCompetencyRating(ratingData)) return false;

  // Required scope: all stage competency actions when available.
  // Fallback: selected ideal actions when stage data is unavailable.
  const requiredActions = getRequiredCompetencyActions(item);
  if (Object.keys(requiredActions).length === 0) {
    return true;
  }

  return Object.entries(requiredActions).every(([competencyId, actionIndexes]) =>
    actionIndexes.every((actionIndex) =>
      hasRatingValue(ratingData?.[competencyId]?.[actionIndex])
    )
  );
}

export default function SubmitButton({
  performanceGoals,
  competencyGoals,
  onSubmitSuccess,
  onRefreshData,
  isPeriodEditable = true,
  disabled = false,
}: SubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

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

  // Get all editable assessments (draft or submitted, not approved)
  const editablePerformanceAssessments = isPeriodEditable
    ? performanceGoals.filter(
        (item) => item.selfAssessment?.status === 'draft' || item.selfAssessment?.status === 'submitted'
      )
    : [];
  const editableCompetencyAssessments = isPeriodEditable
    ? competencyGoals.filter(
        (item) => item.selfAssessment?.status === 'draft' || item.selfAssessment?.status === 'submitted'
      )
    : [];

  // Check completion status
  const incompletePerformance = editablePerformanceAssessments.filter(
    (item) => !isPerformanceAssessmentComplete(item)
  );
  const incompleteCompetency = editableCompetencyAssessments.filter(
    (item) => !isCompetencyAssessmentComplete(item)
  );

  const hasIncomplete = incompletePerformance.length > 0 || incompleteCompetency.length > 0;
  const hasEditableAssessments = editablePerformanceAssessments.length > 0 || editableCompetencyAssessments.length > 0;

  // Check if all editable assessments are already submitted (no drafts left)
  const allAlreadySubmitted = hasEditableAssessments &&
    editablePerformanceAssessments.every((item) => item.selfAssessment?.status === 'submitted') &&
    editableCompetencyAssessments.every((item) => item.selfAssessment?.status === 'submitted');

  // Get IDs of assessments to submit (only draft ones need submission)
  const assessmentIdsToSubmit = [
    ...editablePerformanceAssessments
      .filter((item) => item.selfAssessment?.status === 'draft' && isPerformanceAssessmentComplete(item))
      .map((item) => item.selfAssessment!.id),
    ...editableCompetencyAssessments
      .filter((item) => item.selfAssessment?.status === 'draft' && isCompetencyAssessmentComplete(item))
      .map((item) => item.selfAssessment!.id),
  ];

  // Get IDs of submitted assessments that can be reopened
  const assessmentIdsToReopen = [
    ...editablePerformanceAssessments
      .filter((item) => item.selfAssessment?.status === 'submitted')
      .map((item) => item.selfAssessment!.id),
    ...editableCompetencyAssessments
      .filter((item) => item.selfAssessment?.status === 'submitted')
      .map((item) => item.selfAssessment!.id),
  ];

  const canSubmit = assessmentIdsToSubmit.length > 0 && !hasIncomplete;
  const canReopen = assessmentIdsToReopen.length > 0;

  const handleCancel = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      announceToScreenReader('操作がキャンセルされました', 'polite');
    }
  };

  // Handle button click - flush auto-saves, refresh data, then open dialog
  const handleButtonClick = async () => {
    if (!isPeriodEditable) return;

    setIsRefreshing(true);
    try {
      await flushSelfAssessmentAutoSaves();
      if (onRefreshData) {
        await onRefreshData();
      }
    } finally {
      setIsRefreshing(false);
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
    } catch {
      setIsOpen(false);
      toast.error('予期せぬエラーが発生しました', {
        description: 'しばらく時間をおいて再度お試しください。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (assessmentIdsToReopen.length === 0) return;

    announceToScreenReader('自己評価の編集を再開します', 'assertive');
    setIsReopening(true);

    try {
      // Reopen all submitted assessments
      const results = await Promise.all(
        assessmentIdsToReopen.map((id) => reopenSelfAssessmentAction(id))
      );

      const failedCount = results.filter((r) => !r.success).length;
      const successCount = results.filter((r) => r.success).length;

      setIsOpen(false);

      if (failedCount === 0) {
        toast.success(`${successCount}件の自己評価の編集を再開しました`, {
          description: '内容を修正後、再度提出してください。',
        });
        onSubmitSuccess?.();
      } else if (successCount > 0) {
        toast.error(`${successCount}件成功、${failedCount}件失敗しました`, {
          description: '失敗した項目は再度お試しください。',
        });
        onSubmitSuccess?.();
      } else {
        toast.error('編集の再開に失敗しました', {
          description: 'もう一度お試しください。',
        });
      }
    } catch {
      setIsOpen(false);
      toast.error('予期せぬエラーが発生しました', {
        description: 'しばらく時間をおいて再度お試しください。',
      });
    } finally {
      setIsReopening(false);
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
        disabled={disabled || isSubmitting || isRefreshing || !hasEditableAssessments || !isPeriodEditable}
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
              ) : allAlreadySubmitted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5 text-blue-600" aria-hidden="true" />
              )}
              {allAlreadySubmitted ? '提出状況' : '自己評価を提出しますか？'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {allAlreadySubmitted ? '現在の提出状況を確認してください。' : '提出内容を確認してください。'}
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
            ) : allAlreadySubmitted ? (
              <div
                className="p-3 rounded-md border-l-4 bg-green-50 border-green-500"
                role="region"
                aria-label="提出状況"
              >
                <p className="text-sm font-medium text-green-700">
                  すべての自己評価は提出済みです
                </p>
                <p className="text-sm mt-1 text-green-700">
                  上司による承認をお待ちください。
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  内容を修正する場合は「編集を再開」をクリックしてください。
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
                  className="p-3 rounded-md border-l-4 bg-muted/50 border-blue-500"
                  role="region"
                  aria-label="補足情報"
                >
                  <p className="text-sm font-medium text-foreground">
                    補足情報:
                  </p>
                  <p className="text-sm mt-1">
                    提出後に修正が必要な場合は「編集を再開」から再編集できます。
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || isReopening}
              className={`focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all ${isMobile ? 'w-full h-12 text-base touch-manipulation' : ''}`}
              aria-label="操作をキャンセルしてダイアログを閉じます"
              tabIndex={0}
            >
              {allAlreadySubmitted ? '閉じる' : 'キャンセル'}
            </Button>
            {allAlreadySubmitted && canReopen && (
            <Button
              onClick={handleReopen}
              disabled={isReopening}
              variant="outline"
              className={`border-amber-500 text-amber-700 hover:bg-amber-50 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all ${isMobile ? 'w-full h-12 text-base touch-manipulation' : ''}`}
              aria-label="編集を再開して自己評価を修正します"
              tabIndex={0}
            >
              {isReopening ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  <span aria-live="polite">処理中...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  編集を再開
                </>
              )}
            </Button>
            )}
            {!allAlreadySubmitted && (
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
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
