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
import {
  createSupervisorFeedbackAction,
  getSupervisorFeedbacksByAssessmentAction,
  submitSupervisorFeedbackAction,
} from "@/api/server-actions/supervisor-feedbacks";
import { flushSupervisorFeedbackAutoSaves } from "../hooks/useSupervisorFeedbackAutoSave";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useResponsiveBreakpoint } from "@/hooks/useResponsiveBreakpoint";
import { generateAccessibilityId, announceToScreenReader } from "@/utils/accessibility";
import type { UUID } from "@/api/types";
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

type SupervisorSubmitTarget = {
  selfAssessmentId: string;
  periodId: string;
  feedbackId?: string;
  feedbackStatus?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function findFeedbackByAssessmentWithRetry(
  selfAssessmentId: UUID,
  retryDelays: number[] = [0]
): Promise<string | null> {
  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay);
    }

    const existingResult = await getSupervisorFeedbacksByAssessmentAction(selfAssessmentId);
    if (existingResult.success && existingResult.data?.id) {
      return existingResult.data.id;
    }
  }

  return null;
}

function getSubmittableTargets(
  performanceGoals: PerformanceGoalSupervisorData[],
  competencyGoals: CompetencySupervisorData[]
): SupervisorSubmitTarget[] {
  const targets: SupervisorSubmitTarget[] = [
    ...performanceGoals.map((goal) => ({
      selfAssessmentId: goal.selfAssessmentId,
      periodId: goal.periodId,
      feedbackId: goal.feedbackId,
      feedbackStatus: goal.feedbackStatus,
    })),
    ...competencyGoals.map((competency) => ({
      selfAssessmentId: competency.selfAssessmentId,
      periodId: competency.periodId,
      feedbackId: competency.feedbackId,
      feedbackStatus: competency.feedbackStatus,
    })),
  ].filter(
    (target) =>
      !!target.selfAssessmentId &&
      !!target.periodId &&
      target.feedbackStatus !== "submitted"
  );

  const deduplicated = new Map<string, SupervisorSubmitTarget>();
  targets.forEach((target) => {
    if (!deduplicated.has(target.selfAssessmentId)) {
      deduplicated.set(target.selfAssessmentId, target);
    }
  });
  return Array.from(deduplicated.values());
}

async function ensureFeedbackId(target: SupervisorSubmitTarget): Promise<string | null> {
  if (target.feedbackId) {
    return target.feedbackId;
  }

  const existingId = await findFeedbackByAssessmentWithRetry(
    target.selfAssessmentId as UUID
  );
  if (existingId) {
    return existingId;
  }

  const createResult = await createSupervisorFeedbackAction({
    selfAssessmentId: target.selfAssessmentId as UUID,
    periodId: target.periodId as UUID,
    action: "PENDING",
    status: "draft",
  });
  if (createResult.success && createResult.data) {
    return createResult.data.id;
  }

  return findFeedbackByAssessmentWithRetry(
    target.selfAssessmentId as UUID,
    [150, 300, 600]
  );
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
  const [feedbackIdsToSubmit, setFeedbackIdsToSubmit] = useState<string[]>([]);

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

  const submittableTargets = useMemo(
    () => getSubmittableTargets(performanceGoals, competencyGoals),
    [performanceGoals, competencyGoals]
  );
  const hasSubmittableFeedbacks = submittableTargets.length > 0;
  const canSubmit = feedbackIdsToSubmit.length > 0;

  const handleCancel = () => {
    if (!isSubmitting) {
      setFeedbackIdsToSubmit([]);
      setIsOpen(false);
      announceToScreenReader('操作がキャンセルされました', 'polite');
    }
  };

  // Handle button click - refresh data first, then open dialog
  const handleButtonClick = async () => {
    setIsRefreshing(true);
    try {
      await flushSupervisorFeedbackAutoSaves();
      if (onRefreshData) {
        await onRefreshData();
      }

      const ensuredFeedbackIds = (
        await Promise.all(submittableTargets.map((target) => ensureFeedbackId(target)))
      ).filter((feedbackId): feedbackId is string => !!feedbackId);

      const uniqueIds = Array.from(new Set(ensuredFeedbackIds));
      setFeedbackIdsToSubmit(uniqueIds);
      if (uniqueIds.length === 0) {
        toast.error("提出可能な評価が見つかりません", {
          description: "ページを更新して再度お試しください。",
        });
        return;
      }
      setIsOpen(true);
    } catch {
      toast.error('自動保存に失敗しました', {
        description: '保存完了後に再度お試しください。',
      });
      return;
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async () => {
    if (feedbackIdsToSubmit.length === 0) return;

    announceToScreenReader('評価の提出処理を開始します', 'assertive');
    setIsSubmitting(true);

    try {
      // Submit all feedbacks with APPROVED action
      const results = await Promise.all(
        feedbackIdsToSubmit.map((feedbackId) =>
          submitSupervisorFeedbackAction(feedbackId, {
            action: 'APPROVED',
          })
        )
      );

      const failedCount = results.filter((r) => !r.success).length;
      const successCount = results.filter((r) => r.success).length;

      setFeedbackIdsToSubmit([]);
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
      setFeedbackIdsToSubmit([]);
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
        size="lg"
        variant={hasSubmittableFeedbacks ? "default" : "outline"}
        disabled={disabled || isSubmitting || isRefreshing || !hasSubmittableFeedbacks}
        onClick={handleButtonClick}
        className="flex h-12 w-full items-center justify-center space-x-2 px-8 text-base font-semibold sm:w-auto sm:min-w-[220px]"
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
                提出対象: {feedbackIdsToSubmit.length}件の評価
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
