"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { returnSupervisorFeedbackAction } from "@/api/server-actions/supervisor-feedbacks";
import { returnCoreValueFeedbackAction } from "@/api/server-actions/core-values";
import { useResponsiveBreakpoint } from "@/hooks/useResponsiveBreakpoint";
import type { CoreValueFeedback } from "@/api/types";
import type { PerformanceGoalSupervisorData } from "../display/PerformanceGoalsSupervisorEvaluation";
import type { CompetencySupervisorData } from "../display/CompetencySupervisorEvaluation";

interface ReturnButtonProps {
  performanceGoals: PerformanceGoalSupervisorData[];
  competencyGoals: CompetencySupervisorData[];
  coreValueFeedback?: CoreValueFeedback | null;
  onReturnSuccess?: () => void;
  onRefreshData?: () => Promise<void>;
  disabled?: boolean;
}

interface ReturnableItem {
  feedbackId: string;
  label: string;
  category: string;
  type: 'supervisor' | 'core-value';
}

/**
 * Check if a feedback can be returned (has feedbackId and not already approved/submitted)
 */
function canReturnFeedback(feedbackId?: string, feedbackStatus?: string): boolean {
  return !!feedbackId && feedbackStatus !== 'submitted';
}

export default function ReturnButton({
  performanceGoals,
  competencyGoals,
  coreValueFeedback,
  onReturnSuccess,
  onRefreshData,
  disabled = false,
}: ReturnButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, string>>({});

  const { isMobile } = useResponsiveBreakpoint();

  // Build list of returnable items
  const returnableItems: ReturnableItem[] = useMemo(() => {
    const items: ReturnableItem[] = [];

    performanceGoals.forEach((goal) => {
      if (canReturnFeedback(goal.feedbackId, goal.feedbackStatus)) {
        items.push({
          feedbackId: goal.feedbackId!,
          label: goal.specificGoal,
          category: "業績目標",
          type: "supervisor",
        });
      }
    });

    // Deduplicate competency goals by feedbackId
    const seenFeedbackIds = new Set<string>();
    competencyGoals.forEach((comp) => {
      if (canReturnFeedback(comp.feedbackId, comp.feedbackStatus) && !seenFeedbackIds.has(comp.feedbackId!)) {
        seenFeedbackIds.add(comp.feedbackId!);
        items.push({
          feedbackId: comp.feedbackId!,
          label: comp.name,
          category: "コンピテンシー",
          type: "supervisor",
        });
      }
    });

    // Core value feedback
    if (coreValueFeedback && canReturnFeedback(coreValueFeedback.id, coreValueFeedback.status)) {
      items.push({
        feedbackId: coreValueFeedback.id,
        label: "コアバリュー評価",
        category: "コアバリュー",
        type: "core-value",
      });
    }

    return items;
  }, [performanceGoals, competencyGoals, coreValueFeedback]);

  const hasReturnableItems = returnableItems.length > 0;
  const canReturn = selectedIds.size > 0 && [...selectedIds].every((id) => comments[id]?.trim());

  const handleButtonClick = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      try {
        await onRefreshData();
      } finally {
        setIsRefreshing(false);
      }
    }
    // Reset state when opening
    setSelectedIds(new Set());
    setComments({});
    setIsOpen(true);
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setIsOpen(false);
    }
  };

  const handleToggle = (feedbackId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(feedbackId)) {
        next.delete(feedbackId);
      } else {
        next.add(feedbackId);
      }
      return next;
    });
  };

  const handleCommentChange = (feedbackId: string, value: string) => {
    setComments((prev) => ({ ...prev, [feedbackId]: value }));
  };

  const handleSubmit = async () => {
    if (!canReturn) return;

    setIsSubmitting(true);

    try {
      const results = await Promise.all(
        [...selectedIds].map((feedbackId) => {
          const item = returnableItems.find(i => i.feedbackId === feedbackId);
          if (item?.type === 'core-value') {
            return returnCoreValueFeedbackAction(feedbackId, {
              returnComment: comments[feedbackId],
            });
          }
          return returnSupervisorFeedbackAction(feedbackId, {
            returnComment: comments[feedbackId],
          });
        })
      );

      const failedCount = results.filter((r) => !r.success).length;
      const successCount = results.filter((r) => r.success).length;

      setIsOpen(false);

      if (failedCount === 0) {
        toast.success(`${successCount}件の評価を差し戻しました`, {
          description: '部下に修正依頼が送信されました。',
        });
        onReturnSuccess?.();
      } else if (successCount > 0) {
        toast.error(`${successCount}件成功、${failedCount}件失敗しました`, {
          description: '失敗した項目は再度お試しください。',
        });
        onReturnSuccess?.();
      } else {
        toast.error('差し戻しに失敗しました', {
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
    <>
      <Button
        variant="outline"
        disabled={disabled || isSubmitting || isRefreshing || !hasReturnableItems}
        onClick={handleButtonClick}
        className="flex items-center space-x-2 border-amber-500 text-amber-700 hover:bg-amber-50"
        aria-label="評価を差し戻す"
      >
        {isRefreshing ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
        )}
        <span>{isRefreshing ? "確認中..." : "差し戻し"}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className={`${isMobile ? 'mx-4 max-w-sm' : 'max-w-lg'}`}
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
              <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
              差し戻し対象を選択してください
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              選択した項目にフィードバックを記入し、部下に修正を依頼します。
            </DialogDescription>
          </DialogHeader>

          <div className={`space-y-4 max-h-[60vh] overflow-y-auto ${isMobile ? 'px-4 pb-3' : 'px-6 pb-4'}`}>
            {returnableItems.map((item) => (
              <div
                key={item.feedbackId}
                className={`rounded-md border p-3 transition-colors ${
                  selectedIds.has(item.feedbackId)
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`return-${item.feedbackId}`}
                    checked={selectedIds.has(item.feedbackId)}
                    onCheckedChange={() => handleToggle(item.feedbackId)}
                    disabled={isSubmitting}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`return-${item.feedbackId}`}
                    className="flex-1 cursor-pointer"
                  >
                    <span className="text-xs text-muted-foreground">{item.category}</span>
                    <p className="text-sm font-medium">{item.label}</p>
                  </label>
                </div>

                {selectedIds.has(item.feedbackId) && (
                  <div className="mt-3 ml-7">
                    <Textarea
                      placeholder="修正すべき点やフィードバックを記入してください..."
                      value={comments[item.feedbackId] || ""}
                      onChange={(e) => handleCommentChange(item.feedbackId, e.target.value)}
                      disabled={isSubmitting}
                      rows={3}
                      className="text-sm"
                    />
                    {!comments[item.feedbackId]?.trim() && (
                      <p className="text-xs text-red-500 mt-1">フィードバックを入力してください</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className={isMobile ? 'flex-col-reverse gap-2 pt-4' : 'gap-3 pt-4'}>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className={isMobile ? 'w-full h-12 text-base' : ''}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canReturn || isSubmitting}
              className={`bg-amber-600 hover:bg-amber-700 text-white ${isMobile ? 'w-full h-12 text-base' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  処理中...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  差し戻す ({selectedIds.size}件)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
