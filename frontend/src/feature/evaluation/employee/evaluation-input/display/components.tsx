"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Clock, Loader2, MessageSquare } from "lucide-react";
import type { GoalWithAssessment } from "./index";
import type { SaveStatus } from "../hooks/useSelfAssessmentAutoSave";

/**
 * Save status indicator component
 * Shows the current save state for auto-save functionality
 */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <>
      {status === "saving" && (
        <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          保存中...
        </span>
      )}
      {status === "saved" && (
        <span className="text-xs text-green-600 flex items-center gap-1">
          ✓ 一時保存済み
        </span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          ⚠ 保存失敗
        </span>
      )}
    </>
  );
}

/**
 * Supervisor feedback alert component
 * Displays feedback from supervisor when available
 *
 * 3 visual states (priority order):
 * 1. APPROVED (green) — action === 'APPROVED'
 * 2. RETURNED (red) — action === 'PENDING' && returnComment present
 * 3. PENDING (amber) — action === 'PENDING' && no returnComment
 *
 * Note: supervisorComment and supervisorRatingCode are internal and NOT shown to subordinate.
 */
export function SupervisorFeedbackAlert({
  goalWithAssessment,
}: {
  goalWithAssessment: GoalWithAssessment;
}) {
  const { supervisorFeedback } = goalWithAssessment;

  if (!supervisorFeedback) {
    return null;
  }

  const isApproved = supervisorFeedback.action === "APPROVED";
  const isReturned = !isApproved && !!supervisorFeedback.returnComment;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const feedbackDate =
    supervisorFeedback.reviewedAt ||
    supervisorFeedback.submittedAt ||
    supervisorFeedback.updatedAt;

  // Determine visual state
  let alertClasses: string;
  let Icon: typeof CheckCircle;
  let iconClasses: string;
  let titleClasses: string;
  let statusText: string;
  let dateClasses: string;

  if (isApproved) {
    alertClasses = "border-green-200 bg-green-50";
    Icon = CheckCircle;
    iconClasses = "h-4 w-4 text-green-600";
    titleClasses = "font-semibold text-green-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（承認済み）";
    dateClasses = "text-sm text-green-800";
  } else if (isReturned) {
    alertClasses = "border-red-200 bg-red-50";
    Icon = AlertCircle;
    iconClasses = "h-4 w-4 text-red-600";
    titleClasses = "font-semibold text-red-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（差し戻し）";
    dateClasses = "text-sm text-red-800";
  } else {
    alertClasses = "border-amber-200 bg-amber-50";
    Icon = Clock;
    iconClasses = "h-4 w-4 text-amber-600";
    titleClasses = "font-semibold text-amber-900 flex items-center gap-2";
    statusText = "上司からのフィードバック（確認中）";
    dateClasses = "text-sm text-amber-800";
  }

  return (
    <Alert variant="default" className={alertClasses}>
      <Icon className={iconClasses} />
      <AlertDescription className="ml-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={titleClasses}>
              <MessageSquare className="h-4 w-4" />
              {statusText}
            </p>
            <div className="flex items-center gap-3">
              {feedbackDate && <p className={dateClasses}>{formatDate(feedbackDate)}</p>}
            </div>
          </div>
          {isReturned && supervisorFeedback.returnComment && (
            <>
              <div className="bg-white p-3 rounded border border-red-200">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {supervisorFeedback.returnComment}
                </p>
              </div>
              <p className="text-sm text-red-700 font-medium">
                修正して再度提出してください。
              </p>
            </>
          )}
          {isApproved && (
            <p className="text-sm text-green-700">承認されました。</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
